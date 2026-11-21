---
name: new-page
description: Add a page to the site under site/, with the shared header, navigation and footer, and link it from every other page. Use when asked to add, create or start a new page or section.
argument-hint: <path such as faq> <title>
---

Add a page to the site: $ARGUMENTS

1. **Settle the address.** A page is a folder with an `index.html`: `faq` becomes `site/faq/index.html`, served at `faq/`. Use lowercase letters, digits and hyphens, and no name starting with a dot. If the path or the title is missing, ask for it.
2. **Stop if it exists.** Never overwrite a page: say it is there and ask what to change.
3. **Copy the shell** of `site/guide/index.html` (`<head>`, `<header>`, `<footer>`), and write the content in `<main>`, starting with an `<h1>` and a `<p class="lead">`.
4. **Fix the depth of every relative link** in the new file: one `../` for each folder between it and `site/`. The stylesheet of `site/a/b/index.html` is `../../style.css`. Never start a link with `/`.
5. **Set the `<title>`** as `Title · {{ props.title }}`.
6. **Add the page to the `<nav>` of every HTML file under `site/`**, the new one included, each with the depth of the file it is in. Keep the order the same in all of them.
7. **Wrap any braces shown as text** in `{% raw %}…{% endraw %}`.
8. **Check it** as `/check-site` does, then report the address of the page and the files you changed.

Do not commit or push unless asked: a push to `main` publishes.
