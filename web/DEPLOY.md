# Deploying the demo (`web/`)

The Lyhna Witness demo is a static site (no build step, no backend). It deploys to **GitHub Pages**
straight from `web/` via `.github/workflows/pages.yml`.

## Public URL

> **https://lyhna-ai.github.io/lyhna-witness/**

## One-time setup (required once, by a repo admin)

The deploy workflow cannot enable Pages by itself. Do this once:

1. Repo **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

That's it. There is nothing else to configure — no branch, no `/docs` folder, no custom domain
required.

## How it deploys

- The `deploy-pages` workflow runs on every push to `main` that touches `web/**` (or the workflow
  file), and can also be run on demand from the Actions tab (**Run workflow**).
- It uploads the `web/` directory as the Pages artifact and publishes it. The site root is `web/`,
  so `web/index.html` (the homepage) is served at the URL above, `web/demo.html` at `/demo.html`, and
  the relative assets (`styles.css`, `app.js`, `data/handoff.js`) resolve under `/lyhna-witness/`.
- Until the one-time **Source: GitHub Actions** step above is done, the workflow run will fail at the
  deploy step with a "Pages not enabled" error — that is expected; enable Pages and re-run it.

## What the site serves

- **`/` (homepage)** — static marketing copy on the receipt grammar. No data, no backend.
- **`/demo.html`** — replays the exact committed receipt from `examples/live-loop/handoff.json` (via the
  generated `web/data/handoff.js`, kept in sync by `test/web-data.test.mjs`) — the receipt that came
  through the real lyhna-mcp-proxy witness loop. The demo never invents data; it renders what the witness
  recorded.
