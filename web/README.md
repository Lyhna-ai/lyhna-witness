# Lyhna Witness — demo landing page (`web/`)

This is the public demo page for **Lyhna Witness** — "AI Work Receipts your clients can trust." It is a self-contained, vanilla HTML/CSS/JS page (no frameworks, no build step, no dependencies) that walks a visitor through one witnessed agent run and prints the deterministic, honest receipt: the agent's *claim* vs. what the *witness* actually saw cross the tool-call wire, a colored label per step (green OK / yellow MISMATCH / red DO NOT SEND), a client-ready capsule, and the verbatim "honesty ceiling" stating what Lyhna can and cannot say. It is labeled honestly as *"Demo workflow. Simulated tools. Real Lyhna receipt rules."* and it renders the **exact committed receipt** from `examples/hermes-zapier/handoff.json` (via the generated `data/handoff.js`, kept in sync by `test/web-data.test.mjs`) so the demo can never silently drift from the real receipt rules.

## Run it

```sh
npx serve web        # or any static host
```

Then open the printed URL. It also works by opening `web/index.html` directly in a browser (the data is shipped as a JS module, so no `fetch()` is needed over `file://`).

## Regenerate the data module

`web/data/handoff.js` is generated from the committed receipt. If `examples/hermes-zapier/handoff.json` changes, regenerate and re-commit:

```sh
node web/build-data.mjs
npm test     # includes the web/data sync guard
```
