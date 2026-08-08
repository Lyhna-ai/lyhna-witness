# Lyhna — marketing site + demo (`web/`)

A self-contained, vanilla HTML/CSS/JS site (no frameworks, no build step, no dependencies) on the
**receipt grammar** — the green/amber/red verdict palette on a clean, monospace-tinged document surface.
The product framing is **Lyhna Desktop**: a local receipt layer for people running their own agents. The
front door leads with the buyer moment — *"Run your agents. Walk away. Come back to receipts."* — and the
deliverable, the **AI Work Receipt Capsule**. ("Proof" is the under-the-hood trust word, not the
headline.) Pages (shared header/footer nav across all five):

- **`index.html`** — the homepage. Hero: *"Run your agents. Walk away. Come back to receipts."* + the
  product/ownership/BYO sentences (buy once · use with all your agents · unlimited local receipts · your
  receipts stay yours; your agents use your keys, models, and tools, Lyhna gives you the receipts). "What
  one run produces" shows the capsule bundle (readable receipt · machine receipt · capsule index ·
  continuation prompt · OKF · PAM-shaped memory · proof refs), each tagged with its trust boundary; then
  "How Lyhna Desktop works" (local adapter → agents route through Lyhna → receipts in your inbox → export
  when you want), the three verdict states, witness-not-orchestrator, the honesty ceiling as the
  differentiator, and carrier-vs-witness.
- **`demo.html`** — the demo, *replayed*. One witnessed run, the deterministic receipt (claim vs. what the
  witness saw; green SUPPORTED / amber MISMATCH / red DO-NOT-SEND), a client-review capsule, and the proof
  boundary (what the receipt proves / refuses to fake). Honestly labeled a *demo scenario, replay* —
  "Demo tools. Real witness loop. Deterministic receipt rules." It renders the **exact committed receipt**
  from `examples/live-loop/handoff.json` via the generated `data/handoff.js`, kept in sync by
  `test/web-data.test.mjs`, so the demo can never drift from the real receipt rules.
- **`install.html`** — **connect your agent through the Lyhna MCP adapter**. Explains the two real
  surfaces: quick-connect (stdio, `npx -y @lyhna/mcp stdio`) wraps an MCP server so the agent's calls are
  witnessed and earn a sealed receipt chain; the full claimed-vs-witnessed **capsule** (claim capture via
  `record_claim` + `export-pack` → `witness-input.json`) comes from the **standing-service** flow
  (QUICKSTART Path B), not stdio alone. To see a receipt with no setup, render the bundled sample with the
  witness CLI. States plainly what works today (adapter on npm; local-by-default demo mode; witness
  renderer from a source clone; signed receipts are an optional hosted add-on; no desktop download / plugin
  store / one-command install; only routed tool calls earn receipts) and the four setup states (Connected
  / Waiting / Test receipt created / Outside the witness path).
- **`pricing.html`** — the **ownership model** only (buy once · use with all your agents · unlimited local
  receipts · your receipts stay yours). Core receipt + every export are included (no artificial upsells);
  hosted signing/verification polish, team sync, and managed verification history are framed as future updates, not
  core-product limits. **No numbers** — they come with the release path.
- **`dashboard.html`** — a **static design preview** of the **Lyhna Desktop receipt inbox** (local device
  bar, summary stats, per-agent status / last witnessed call / receipts / unsupported / DO-NOT-SEND /
  test-receipt). Clearly labeled *preview, not live telemetry* — no desktop download, billing, or live
  data. There is no inbox backend in this repo; it shows the intended experience built from the same local
  receipt data the CLI produces.

Honesty ceiling applies to the marketing too: no claim the site makes exceeds what the receipt makes —
action-level witnessed truth only. The desktop app is a **packaging direction**, not a shipped download —
the site never implies you can download it today. Buyer surfaces avoid
gate/authority/governance/judgment-ledger/SDK language and the raw phrase "fail closed" (use "Lyhna marks
the claim unsupported instead of giving it a pass"); say "local by default" / "MCP-compatible", never
"local-only"; "PAM-shaped" never "PAM-compatible"; agents are witnessed only when their tool calls route
through Lyhna. Pricing numbers and any open/one-command/desktop-download install flow are intentionally
**not** published until they are real/approved.

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
