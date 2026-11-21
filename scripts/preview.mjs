// npm run preview
// Opens the site folder on this computer, to look at it before publishing.
// Templates ({{ props.title }}) are shown as written: only Gatefold renders them.
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const folder = resolve((process.env.GATEFOLD_DIR ?? "").trim() || "site");
const port = Number(process.env.PORT) || 4000;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".pdf": "application/pdf",
};

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    let file = normalize(join(folder, path));
    // Nothing outside the folder, and nothing hidden: the same a reader would get.
    if ((file !== folder && !file.startsWith(folder + sep)) || path.split("/").some((part) => part.startsWith(".")) || path === "/source.json") throw new Error("refused");
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith("/")) {
        response.writeHead(302, { location: `${path}/` }).end();
        return;
      }
      file = join(file, "index.html");
    }
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Previewing ${folder}\n  http://localhost:${port}/\nStop with Ctrl+C.\n`);
});
