# Agent guide

This repository is a site that publishes itself to a [Gatefold](https://github.com/NEWMOLJUD/Gatefold) source. Everything under `site/` is served to readers at `/reader/view/<alias>/`. There are no dependencies and no build, unless the owner added one.

`README.md` is the guide for people. This file is the guide for agents: what to touch, what to leave alone, and how to check your work.

## Map

| Path | What it is | Edit it? |
|---|---|---|
| `site/` | The published site. Every file here reaches readers, keeping its subfolders. | Yes: this is where almost all work happens. |
| `site/index.html` | The front page. Required: a deploy without it fails. | Yes, never delete or rename it. |
| `site/source.json` | Values (`props`) and the extensions that go through the template engine (`render`). Never delivered to readers. | Yes. |
| `site/style.css` | The one stylesheet, shared by every page. | Yes. |
| `scripts/deploy.mjs` | Sends the folder to Gatefold, then removes from the source what is not in the folder. | Only when asked. |
| `scripts/preview.mjs` | A local static server for `site/`. | Only when asked. |
| `.github/workflows/deploy.yml` | Publishes on every push to `main`. | Only when asked. See the rules below. |
| `.env` | The owner's API key, on their computer. Git-ignored. | Never read, print or commit it. |

## Commands

Node.js 22.18 or newer. Nothing to install.

| Command | What it does | Safe to run? |
|---|---|---|
| `npm run preview` | Serves `site/` at `http://localhost:4000/` (`PORT` changes it). Runs until stopped, so start it in the background. | Yes. |
| `npm run deploy:check` | Says what a deploy would upload and remove. Changes nothing, but needs `.env` and reaches the Gatefold. | Yes, when `.env` exists. |
| `npm run deploy` | Publishes for real: live at once, and it removes files. | Only when the owner asks for it in so many words. |

There is no test suite and no linter. Checking your work means previewing it: see [Before you finish](#before-you-finish).

## Writing pages

- **A page is a plain HTML file.** A folder with an `index.html` is a page with a clean address: `site/guide/index.html` is served at `guide/`.
- **Links are relative, always.** The site lives under `/reader/view/<alias>/`, so `href="/style.css"` or `href="/guide/"` breaks once published, although it works in the preview. Write `style.css`, `guide/`, `../style.css`, `../`.
- **Copy the shell of an existing page** (`<head>`, `<header>` with its `<nav>`, `<footer>`) when adding one, and fix the depth of each relative link. `site/guide/index.html` is the model for a page one folder deep.
- **The navigation is repeated in every page.** There are no includes: a new entry in the `<nav>` must be added to every HTML file, with the right depth in each.
- **Reuse `site/style.css`.** Add rules there rather than a `<style>` block or a second stylesheet, and keep its custom properties (colours, spacing) instead of hard-coded values.
- **Names starting with a dot are not published.** Do not put anything a page needs in a hidden file or folder.
- **Limits:** 25 MB per file, 20,000 files per source, 900 bytes per path, no backslash or control character in a name.

## Templates

Files whose extension is listed in `render` of `site/source.json` (by default, `html`) go through Gatefold's template engine before delivery.

```html
<h1>{{ props.title }}</h1>
<p>{{ props.team | default: "Everyone" }}</p>
{% if props.plan == "gold" %}…{% else %}…{% endif %}
{% for item in props.notices %}{{ forloop.index }}. {{ item }}{% endfor %}
```

- Values come from three places, the later winning: the platform, `props` in `site/source.json`, and the reader's own props.
- **A value a reader may not have needs a fallback**: `{{ props.team | default: "Everyone" }}`.
- **To show braces as text** (in documentation, in a code sample), wrap them: `{% raw %}{{ props.title }}{% endraw %}`. Without it, the example is rendered and vanishes.
- **Inline JavaScript or CSS in an HTML file is rendered too.** A `{{` or `{%` in it must be wrapped in `{% raw %}`, or moved to a `.js` / `.css` file, which is not rendered.
- **Props personalise; they do not protect.** Never hide content behind `{% if %}` as if it were access control: who may open the site is decided in the Gatefold console.
- `site/source.json` must stay valid JSON. Do not put anything secret in it: it is not delivered, but it is in the repository.
- **The preview does not render templates.** Seeing `{{ props.title }}` as written at `localhost` is expected, not a bug. Only Gatefold renders them.

For anything beyond what is shown here, read [source.json](https://github.com/NEWMOLJUD/Gatefold#sourcejson) and [Templates](https://github.com/NEWMOLJUD/Gatefold#templates) rather than guessing the syntax.

## Rules that must not be broken

1. **A push to `main` publishes.** When `SOURCE_ACTIVE` is `true`, the change is in front of readers a moment later. Work on a branch; push or merge to `main` only when the owner asks.
2. **A deploy removes.** What is not in the folder is deleted from the source. Deleting, renaming or moving a file in `site/` takes its old address away from readers: say so when you do it, and never point `GATEFOLD_SOURCE` or `GATEFOLD_DIR` somewhere else without being asked.
3. **The API key is an administrator key over every source of the Gatefold.** Never read `.env`, never print or log `GATEFOLD_API_KEY`, never write it into a file, a commit, a page or a command line.
4. **Never add a `pull_request` trigger** (or `pull_request_target`) to the workflow: a pull request must not be able to reach the key. Keep `permissions: contents: read`, `persist-credentials: false` and `cancel-in-progress: false`.
5. **Keep it without dependencies.** Do not add packages, a framework or a build step unless the owner asks. If they do: add a `build` script to `package.json`, set `GATEFOLD_DIR` to its output, commit the `package-lock.json`, and make the generator write relative links.
6. **The repository's settings are the owner's.** Secrets and variables (`GATEFOLD_URL`, `GATEFOLD_SOURCE`, `SOURCE_ACTIVE`, …) are set by hand under **Settings → Secrets and variables → Actions**. Explain what to set; do not try to set it.

## Before you finish

1. Start `npm run preview` in the background and open every page you changed, plus one that links to it.
2. Follow each link and check each asset loads, from the page itself (not by typing the address): this is what catches a wrong `../`.
3. Search what you wrote for links starting with `/`: `grep -rnE '(href|src)="/' site/` should print nothing.
4. If you edited `site/source.json`, parse it: `node -e 'JSON.parse(require("node:fs").readFileSync("site/source.json","utf8"))'`.
5. If you removed, renamed or moved a file, tell the owner which addresses stop working.
6. Stop the preview.

Say plainly what the preview cannot show: templates are only rendered by Gatefold, so a page that depends on `{% if %}` or on a reader's props is unverified until it is published.

## When a deploy fails

The run's summary and log say why. The usual causes:

| Message | Cause |
|---|---|
| **Deploy is off** | `SOURCE_ACTIVE` is not `true`, or it was saved inside an Environment instead of as a repository variable or secret. |
| `Missing: …` | A secret or variable is not set. |
| `Gatefold refused the API key` | The key is expired, revoked, or not an administrator key. |
| `There is no index.html at the root of …` | `site/index.html` was removed, or `GATEFOLD_DIR` points at the wrong folder, or the build did not run. |
| `Gatefold would refuse N file(s)` | A file is too large or badly named. Nothing was sent. |
| `N step(s) failed` | Some uploads did not go through; nothing was removed. Running the workflow again is safe. |

To go back to an earlier version of the site, revert the commit and push: nothing is versioned on Gatefold.
