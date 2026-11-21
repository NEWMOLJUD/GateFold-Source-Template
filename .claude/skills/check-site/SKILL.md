---
name: check-site
description: Check the site under site/ before it is pushed - links, assets, source.json and what a deploy would remove. Use before committing changes to the site, or when asked whether it is ready to publish.
---

Check the site before it is published. Change nothing unless asked: report.

1. **Absolute links.** `grep -rnE '(href|src)="/' site/` must print nothing. Each match breaks once the site is under `/reader/view/<alias>/`.
2. **source.json.** `node -e 'JSON.parse(require("node:fs").readFileSync("site/source.json","utf8"))'` must not fail.
3. **The front page.** `site/index.html` must exist.
4. **Links and assets.** Start `npm run preview` in the background. For every HTML file under `site/`, request each relative `href` and `src` it holds, resolved from that page's own address, and list the ones that do not answer 200. Stop the preview afterwards.
5. **Navigation.** The `<nav>` of every page must list the same pages in the same order.
6. **Templates.** List every `{{` and `{%` outside `{% raw %}` that names a prop missing from `site/source.json` and without a `default` filter: it may render empty. Mention inline `<script>` or `<style>` holding braces.
7. **What disappears.** `git status` and `git diff --stat main -- site/`: name each file removed, renamed or moved, since its old address stops working on the next deploy.
8. **Limits.** No file over 25 MB, and nothing a page needs in a name starting with a dot.

Report as a short list: what passed, what failed with file and line, and what could not be checked here. Templates are only rendered by Gatefold, so say that pages depending on them are unverified until published.
