# Gatefold Source Template

**A site that publishes itself to your [Gatefold](https://github.com/NEWMOLJUD/Gatefold) on every push.**

Create a repository from this template, tell it where your Gatefold is, and the `site/` folder is served to your readers at `/reader/view/<alias>/`. No dependencies to install, nothing to build.

## Quick start

You need a Gatefold already running, and an administrator account on it.

**1. Create your repository.** Press **Use this template** and choose **Private**.

> [!WARNING]
> Use the template button, not a fork. A fork of a public repository cannot be private, so whoever finds it reads your whole site; and GitHub keeps workflows turned off in forks until you enable them by hand.

**2. Create an API key.** In the Gatefold console, under **API keys**, create an administrator key and give it an end date. Copy it: it is shown once.

**3. Tell the repository where to publish.** In your repository, open **Settings → Secrets and variables → Actions**.

On the **Secrets** tab:

| Secret | Value |
|---|---|
| `GATEFOLD_API_KEY` | The key from step 2. |

On the **Variables** tab:

| Variable | Value |
|---|---|
| `GATEFOLD_URL` | The address of your Gatefold, such as `https://pages.example.com`. |
| `GATEFOLD_SOURCE` | The alias of the source: lowercase letters, digits and hyphens, such as `handbook`. It is created, private, if it does not exist. |
| `SOURCE_ACTIVE` | `true` |

**4. Publish.** Push to `main`, or open **Actions → Deploy to Gatefold → Run workflow**. The run's summary ends with the address of the site.

**5. Choose who reads it.** A new source is private. In the Gatefold console, tick it on each reader's page, or make it public on the source's page.

From here on, every push to `main` publishes. To pause, set `SOURCE_ACTIVE` to anything other than `true`: the workflow still runs, publishes nothing and says **Deploy is off** in its summary, and the site stays as it is.

> [!TIP]
> If a run says **Deploy is off** although you set `SOURCE_ACTIVE`, it was probably saved inside an *Environment*. It must be a **repository** variable or secret, under **Settings → Secrets and variables → Actions**.

## Write your site

Everything under [`site/`](site/) is published, keeping its subfolders.

- `site/index.html` is required: it is what the address of the source delivers.
- Links between pages are relative (`guide/`, `../style.css`).
- HTML goes through Gatefold's template engine, so a page can say `{{ props.title }}`. The values and the rendered extensions are in [`site/source.json`](site/source.json), which is never delivered to readers. See [source.json](https://github.com/NEWMOLJUD/Gatefold#sourcejson) and [Templates](https://github.com/NEWMOLJUD/Gatefold#templates).
- Files and folders whose name starts with a dot are left out. A file can have up to 25 MB, and a source up to 20,000 files.

To look at the site on your computer before pushing (templates are shown as written, since only Gatefold renders them):

```bash
npm run preview
```

### Using a site generator

If your site is built (VitePress, MkDocs, Astro, anything that ends in a folder of files), add a `build` script to `package.json` and point `GATEFOLD_DIR` at its output, as a repository variable:

| Variable | Value |
|---|---|
| `GATEFOLD_DIR` | The folder to publish, such as `dist`. Default: `site`. |

The workflow runs `npm ci` when there is a `package-lock.json`, then `npm run build` when it exists, then the deploy. Make the generator write relative links, because the site lives under `/reader/view/<alias>/`.

## Deploy from your computer

You need [Node.js](https://nodejs.org) 22.18 or newer.

```bash
cp .env.example .env
```

Fill in `.env` (it is git-ignored), then see what would happen, changing nothing:

```bash
npm run deploy:check
```

And publish:

```bash
npm run deploy
```

## Settings

| Name | Where on GitHub | What it is | Default |
|---|---|---|---|
| `GATEFOLD_API_KEY` | Secret | An administrator API key. | Required |
| `GATEFOLD_URL` | Variable | The address of your Gatefold. Must be `https://`. | Required |
| `GATEFOLD_SOURCE` | Variable | The alias of the source. | Required |
| `SOURCE_ACTIVE` | Variable | The workflow runs only when this is `true`. | Off |
| `GATEFOLD_DIR` | Variable | The folder to publish. | `site` |
| `GATEFOLD_PRUNE` | Variable | Remove from the source what is not in the folder. | `true` |
| `GATEFOLD_PUBLIC` | Variable | Create the source open to everyone. Only used when the deploy creates it. | `false` |

`GATEFOLD_URL`, `GATEFOLD_SOURCE` and `SOURCE_ACTIVE` may be secrets instead, if you would rather not show them. When both exist, the variable wins.

## Good to know

> [!WARNING]
> An administrator key can do everything an administrator can, on **every** source of your Gatefold. Give it an end date, keep it only as a secret, and revoke it under **API keys** when it is no longer used. Do not add a `pull_request` trigger to the workflow.

- **The folder is the truth.** After uploading, the deploy removes from the source every file that is not in the folder. If `GATEFOLD_SOURCE` names a source that already holds something else, that content is replaced. Run `npm run deploy:check` first when in doubt, or set `GATEFOLD_PRUNE` to `false`.
- **A change is live at once, file by file.** For a moment during a deploy, a reader may get a new page with an old stylesheet. Assets go first and the front page last to keep that moment short. If an upload fails, nothing is removed and the run fails: push again, or re-run it.
- **Every deploy sends every file.** Fine for documentation; a site with thousands of large files will take a while.
- **Whoever reads the repository reads the site.** Keep it private if the source is.
- **Nothing is versioned on Gatefold.** Your repository is the history: to go back, revert the commit and push.

## License

[MIT](LICENSE)
