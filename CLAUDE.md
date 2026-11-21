# Claude Code

The guide for every agent is in `AGENTS.md`, imported here so there is one copy to keep up to date:

@AGENTS.md

## Only for Claude Code

- **Permissions** are in `.claude/settings.json`: the preview and the dry run are allowed, reading `.env` is denied, and a real deploy or a push always asks the owner first. Do not loosen them unless asked.
- **Skills** in `.claude/skills/`:
  - `/new-page <path> <title>` adds a page with the shared shell and links it from the navigation of every page.
  - `/check-site` runs the checks of "Before you finish" and reports what it found.
- Run `npm run preview` in the background and stop it when you are done: it never ends by itself.
- A cloud session has no `.env` and must not be given one. There, `npm run deploy:check` fails with `Missing: …`, which is expected: check with the preview, and let the workflow do the publishing.
