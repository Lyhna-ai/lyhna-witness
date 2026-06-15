# Lyhna — marketing site + demo (`web/`)

A self-contained, vanilla HTML/CSS/JS site (no frameworks, no build step, no dependencies) on the
**receipt grammar** — the green/amber/red verdict palette on a clean, monospace-tinged document surface.
Pages:

- **`index.html`** — the homepage. Anchor noun: **proof** (proof of witnessed tool-boundary action, never
  outcome/delivery/correctness). Sells the why: the receipt's three verdict states, the honesty ceiling
  as the differentiator, the agent-native trio (MCP / OKF / PAM-shaped memory bundle), and carrier-vs-witness.
- **`demo.html`** — the demo, *replayed*. Walks a visitor through one witnessed agent run and prints the
  deterministic receipt: the agent's *claim* vs. what the *witness* saw cross the tool boundary, a colored
  label per step (green SUPPORTED / amber MISMATCH / red DO-NOT-SEND), a client-review capsule, and the
  buyer-facing proof boundary (what the receipt proves / refuses to fake). Labeled honestly as a
  *demo scenario, replay* — "Demo tools. Real witness loop. Deterministic receipt rules." It renders the
  **exact committed receipt** from `examples/live-loop/handoff.json` (the canonical receipt that came
  through the lyhna-mcp-proxy standing-service loop) via the generated `data/handoff.js`, kept in sync by
  `test/web-data.test.mjs`, so the demo can never silently drift from the real receipt rules.

Honesty ceiling applies to the marketing too: no claim the site makes exceeds what the receipt makes —
action-level witnessed truth only. Pricing numbers and an open install flow are intentionally **not**
published until they are real/approved.

## Run it

```sh
npx serve web        # or any static host
```

Then open the printed URL (`/` is the homepage, `/demo.html` is the demo). It also works by opening the
HTML files directly in a browser (the data is shipped as a JS module, so no `fetch()` is needed over
`file://`).

## Regenerate the data module

`web/data/handoff.js` is generated from the committed receipt. If `examples/live-loop/handoff.json` changes, regenerate and re-commit:

```sh
node web/build-data.mjs
npm test     # includes the web/data sync guard
```
