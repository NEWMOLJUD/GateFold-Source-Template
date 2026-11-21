// npm run deploy            publish the folder to your Gatefold
// npm run deploy:check      say what would happen, change nothing
//
// Sends every file of the site folder to one Gatefold source, then removes
// from the source what is no longer in the folder. Settings come from the
// environment (locally, from a .env file):
//
//   GATEFOLD_URL       the address of your Gatefold     https://pages.example.com
//   GATEFOLD_SOURCE    the alias of the source          handbook
//   GATEFOLD_API_KEY   an administrator API key         (a secret)
//
//   GATEFOLD_DIR       the folder to publish            default: site
//   GATEFOLD_PRUNE     remove what is not in the folder default: true
//   GATEFOLD_PUBLIC    open a NEW source to everyone    default: false
import { appendFileSync, existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

// The limits of the server (sandbox/core.ts in Gatefold), checked here first so nothing is sent in vain.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_FILES = 20_000;
const MAX_PATH_BYTES = 900;
const ALIAS = /^[a-z0-9-]{1,64}$/;
const PARALLEL = 4;
const ATTEMPTS = 4;

const dryRun = process.argv.includes("--dry-run");

// On your computer the settings live in .env; what the environment already has wins.
if (existsSync(".env")) process.loadEnvFile(".env");

function say(text) {
  process.stdout.write(`${text}\n`);
}

function fail(message, hint) {
  process.stderr.write(`\n✗ ${message}\n${hint ? `→ ${hint}\n` : ""}\n`);
  process.exit(1);
}

function flag(name, fallback) {
  const value = (process.env[name] ?? "").trim().toLowerCase();
  if (value === "") return fallback;
  if (["true", "1", "yes"].includes(value)) return true;
  if (["false", "0", "no"].includes(value)) return false;
  fail(`${name} must be "true" or "false", not ${JSON.stringify(process.env[name])}.`);
}

// --- Settings ---------------------------------------------------------------

const missing = ["GATEFOLD_URL", "GATEFOLD_SOURCE", "GATEFOLD_API_KEY"].filter((name) => !(process.env[name] ?? "").trim());
if (missing.length > 0) {
  fail(
    `Missing: ${missing.join(", ")}.`,
    "On GitHub, set them under Settings → Secrets and variables → Actions. On your computer, copy .env.example to .env and fill it in.",
  );
}

const alias = process.env.GATEFOLD_SOURCE.trim();
const key = process.env.GATEFOLD_API_KEY.trim();
const folder = resolve((process.env.GATEFOLD_DIR ?? "").trim() || "site");
const prune = flag("GATEFOLD_PRUNE", true);
const makePublic = flag("GATEFOLD_PUBLIC", false);

if (!ALIAS.test(alias)) fail(`GATEFOLD_SOURCE is not a valid alias: ${JSON.stringify(alias)}.`, "Use 1 to 64 lowercase letters, digits and hyphens, for example: handbook");

let origin;
try {
  const url = new URL(process.env.GATEFOLD_URL.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    fail("GATEFOLD_URL must start with https://.", "Over plain http the API key would travel where anyone on the way can read it.");
  }
  // Only the address of the app: a path such as /admin/ pasted along is dropped.
  origin = url.origin;
} catch {
  fail(`GATEFOLD_URL is not an address: ${JSON.stringify(process.env.GATEFOLD_URL)}.`, "It looks like https://pages.example.com");
}

const sourceApi = `${origin}/api/admin/sources/${alias}`;
const siteAddress = `${origin}/reader/view/${alias}/`;

// --- The folder -------------------------------------------------------------

/** Every file under the folder as { path, size }, with `/` between the parts. Hidden names are left out, as the server refuses them. */
async function walk(directory, prefix, found, skipped) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    fail(`The folder ${directory} cannot be read.`, "Set GATEFOLD_DIR to the folder that holds your site, or run your build first.");
  }
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(directory, entry.name);
    if (entry.name.startsWith(".")) {
      skipped.push(path);
      continue;
    }
    // A link is followed: what it points to is what gets published.
    const info = await stat(full).catch(() => null);
    if (!info) {
      skipped.push(path);
      continue;
    }
    if (info.isDirectory()) await walk(full, path, found, skipped);
    else if (info.isFile()) found.push({ path, full, size: info.size });
  }
}

function pathProblem(file) {
  // eslint-disable-next-line no-control-regex
  if (file.path.includes("\\") || /[\u0000-\u001f\u007f]/.test(file.path)) return "its name has a backslash or a control character";
  if (new TextEncoder().encode(file.path).length > MAX_PATH_BYTES) return `its path is longer than ${MAX_PATH_BYTES} bytes`;
  if (file.size > MAX_FILE_BYTES) return `it has ${(file.size / 1024 / 1024).toFixed(1)} MB and the maximum is ${MAX_FILE_BYTES / 1024 / 1024} MB`;
  return null;
}

/** Pages go after what they load, and the front page last: a reader meets fewer half-updated pages. */
function rank(path) {
  if (path === "index.html") return 3;
  if (path === "source.json") return 2;
  return /\.html?$/i.test(path) ? 1 : 0;
}

const files = [];
const skipped = [];
await walk(folder, "", files, skipped);

const refused = files.map((file) => ({ file, problem: pathProblem(file) })).filter((item) => item.problem);
if (refused.length > 0) {
  fail(`Gatefold would refuse ${refused.length} file(s):\n${refused.map((item) => `    ${item.file.path}: ${item.problem}`).join("\n")}`, "Remove or rename them, then deploy again. Nothing was sent.");
}
if (files.length === 0) fail(`The folder ${folder} has no file to publish.`);
if (files.length > MAX_SOURCE_FILES) fail(`The folder has ${files.length} files and a source holds up to ${MAX_SOURCE_FILES}.`);
if (!files.some((file) => file.path === "index.html")) {
  fail(`There is no index.html at the root of ${folder}.`, "It is what readers get at the address of the source. Check GATEFOLD_DIR, or run your build first.");
}
files.sort((a, b) => rank(a.path) - rank(b.path) || (a.path < b.path ? -1 : 1));

// --- The API ----------------------------------------------------------------

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** One request, tried again when the network or the server stumbles. Answers { status, data }. */
async function call(method, url, body) {
  let last = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await wait(500 * 2 ** (attempt - 2));
    let response;
    try {
      response = await fetch(url, {
        method,
        body,
        headers: { authorization: `Bearer ${key}`, ...(typeof body === "string" ? { "content-type": "application/json" } : {}) },
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      last = error instanceof Error ? (error.cause?.message ?? error.message) : String(error);
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 429 || response.status >= 500) {
      last = data.error ?? `Error ${response.status}`;
      continue;
    }
    return { status: response.status, data };
  }
  throw new Error(`${last} (after ${ATTEMPTS} attempts)`);
}

function address(path) {
  return `${sourceApi}/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Runs the worker over the items, a few at a time. */
async function each(items, worker) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: PARALLEL }, lane));
}

/** Every path the source holds, a thousand at a time. */
async function stored() {
  const paths = [];
  let after = "";
  do {
    const page = await call("GET", `${sourceApi}/files?limit=1000${after ? `&after=${encodeURIComponent(after)}` : ""}`);
    if (page.status !== 200) throw new Error(page.data.error ?? `Error ${page.status}`);
    for (const item of page.data.items) paths.push(item.path);
    after = page.data.next_after ?? "";
  } while (after);
  return paths;
}

// --- Deploy -----------------------------------------------------------------

say(`${dryRun ? "Checking" : "Deploying"} ${files.length} files from ${folder}`);
say(`  to the source "${alias}" at ${origin}`);

let source;
try {
  source = await call("GET", sourceApi);
} catch (error) {
  fail(`Could not reach ${origin}: ${error.message}`, "Check GATEFOLD_URL and that your Gatefold is running.");
}
if (source.status === 401 || source.status === 403) {
  fail("Gatefold refused the API key.", "GATEFOLD_API_KEY must be an administrator key (it starts with cn_a_) that is not expired or revoked. Create one in the console, under API keys.");
}
if (source.status !== 200 && source.status !== 404) {
  fail(`Unexpected answer from ${origin}: ${source.data.error ?? `Error ${source.status}`}`, "Check that GATEFOLD_URL is the address of a Gatefold.");
}
const exists = source.status === 200;

if (dryRun) {
  const kept = new Set(files.map((file) => file.path));
  const extra = exists && prune ? (await stored()).filter((path) => !kept.has(path)) : [];
  say("");
  say(exists ? `The source exists (${source.data.public ? "public" : "private"}, ${source.data.files} files).` : `The source does not exist: it would be created, ${makePublic ? "PUBLIC" : "private"}.`);
  say(`Would upload ${files.length} files:`);
  for (const file of files) say(`  + ${file.path}`);
  if (extra.length > 0) {
    say(`Would remove ${extra.length} files that are not in the folder:`);
    for (const path of extra) say(`  - ${path}`);
  }
  if (skipped.length > 0) say(`Leaving out ${skipped.length} hidden or unreadable: ${skipped.join(", ")}`);
  say("\n✓ Nothing was changed.");
  process.exit(0);
}

if (!exists) {
  const created = await call("POST", `${origin}/api/admin/sources`, JSON.stringify({ alias, public: makePublic }));
  // 409: another deploy created it in the meantime.
  if (created.status !== 201 && created.status !== 409) fail(`Could not create the source: ${created.data.error ?? `Error ${created.status}`}`);
  say(`  Created the source, ${makePublic ? "public" : "private"}.`);
}

const failures = [];
let uploaded = 0;
await each(files, async (file) => {
  try {
    const sent = await call("PUT", address(file.path), await readFile(file.full));
    if (sent.status !== 200 && sent.status !== 201) throw new Error(sent.data.error ?? `Error ${sent.status}`);
    uploaded++;
  } catch (error) {
    failures.push(`${file.path}: ${error.message}`);
  }
});

// Nothing is removed after a failed upload: the old file may be what still keeps a page working.
let removed = 0;
if (prune && failures.length === 0) {
  try {
    const kept = new Set(files.map((file) => file.path));
    const extra = (await stored()).filter((path) => !kept.has(path));
    await each(extra, async (path) => {
      try {
        const gone = await call("DELETE", address(path));
        if (gone.status !== 200 && gone.status !== 404) throw new Error(gone.data.error ?? `Error ${gone.status}`);
        removed++;
      } catch (error) {
        failures.push(`${path}: ${error.message}`);
      }
    });
  } catch (error) {
    failures.push(`Listing the stored files: ${error.message}`);
  }
}

const counts = `${uploaded} uploaded, ${removed} removed${skipped.length ? `, ${skipped.length} hidden left out` : ""}`;
const summary = process.env.GITHUB_STEP_SUMMARY;
const report = (text) => {
  if (!summary) return;
  try {
    appendFileSync(summary, `${text}\n`);
  } catch {
    // The summary is a courtesy: the log already says it.
  }
};

if (failures.length > 0) {
  report(`### Gatefold deploy failed\n\n${counts}, **${failures.length} failed**:\n\n${failures.map((line) => `- \`${line}\``).join("\n")}`);
  fail(
    `${failures.length} step(s) failed (${counts}):\n${failures.map((line) => `    ${line}`).join("\n")}`,
    "What did go through is already published. Fix the cause and deploy again.",
  );
}

report(`### Published to Gatefold\n\n${counts}.\n\n${siteAddress}`);
say(`\n✓ ${counts}.`);
say(`  ${siteAddress}`);
