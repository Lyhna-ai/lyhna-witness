# Lyhna — marketing site + demo (`web/`)

A self-contained, vanilla HTML/CSS/JS site (no frameworks, no build step, no dependencies) on the
**receipt grammar** — the green/amber/red verdict palette on a clean, monospace-tinged document surface.
The front door leads with the deliverable: the **AI Work Receipt Capsule**. ("Proof" is the under-the-hood
trust word, not the headline.) Pages (shared header/footer nav across all five):

- **`index.html`** — the homepage. Hero: *"AI Work Receipts your clients can trust"* + the buyer line.
  "What one run produces" shows the capsule bundle (readable receipt · machine receipt · capsule index ·
  continuation prompt · OKF · PAM-shaped memory · proof refs), each tagged with its trust boundary; then
  the three verdict states, witness-not-orchestrator, the honesty ceiling as the differentiator, and
  carrier-vs-witness.
- **`demo.html`** — the demo, *replayed*. One witnessed run, the deterministic receipt (claim vs. what the
  witness saw; green SUPPORTED / amber MISMATCH / red DO-NOT-SEND), a client-review capsule, and the proof
  boundary (what the receipt proves / refuses to fake). Honestly labeled a *demo scenario, replay* —
  "Demo tools. Real witness loop. Deterministic receipt rules." It renders the **exact committed receipt**
  from `examples/live-loop/handoff.json` via the generated `data/handoff.js`, kept in sync by
  `test/web-data.test.mjs`, so the demo can never drift from the real receipt rules.
- **`install.html`** — **install by agent**. Explains the two real surfaces: quick-connect (stdio,
  `npx -y @lyhna/mcp stdio`) wraps an MCP server so the agent's calls are witnessed and earn a sealed
  receipt chain; the full claimed-vs-witnessed **capsule** (claim capture via `record_claim` +
  `export-pack` → `witness-input.json`) comes from the **standing-service** flow (QUICKSTART Path B), not
  stdio alone. To see a receipt with no setup, render the bundled sample with the witness CLI. States
  plainly what works today (proxy on npm; witness renderer from a source clone; signed receipts need a
  beta key; no plugin store / one-command) and the four setup states (Connected / Waiting / Test receipt
  created / Outside the witness path).
- **`pricing.html`** — the billing **model** only (metered by witnessed action). **No numbers** — they
  open with the private beta.
- **`dashboard.html`** — a **static design preview** of the connected-agents dashboard (account + masked
  key, summary stats, per-agent status / last witnessed call / receipts / unsupported / DO-NOT-SEND /
  test-receipt). Clearly labeled *preview, not live telemetry* — no sign-up, billing, or live data. There
  is no dashboard backend in this repo; it shows the intended experience built from the same receipt data
  the CLI produces.

Honesty ceiling applies to the marketing too: no claim the site makes exceeds what the receipt makes —
action-level witnessed truth only. Buyer surfaces avoid gate/authority/governance/judgment-ledger/SDK
language and the raw phrase "fail closed" (use "Lyhna marks the claim unsupported instead of giving it a
pass"); "PAM-shaped" never "PAM-compatible"; agents are witnessed only when their tool calls route through
Lyhna. Pricing numbers and an open/one-command install flow are intentionally **not** published until they
are real/approved.

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
