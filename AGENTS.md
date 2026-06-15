# AGENTS.md

> 👉 **Start here: read [`LLM-CONTEXT.md`](./LLM-CONTEXT.md) first.** It's the dated, single-page map of
> what Lyhna is, the two-repo architecture, the claim→witness→receipt loop, what the website does,
> current state, and the honesty ceiling. [`THESIS.md`](./THESIS.md) is the canonical product thesis +
> honesty ceiling. This file holds the witness repo's hard invariants.

## What this repo is

`lyhna-witness` — the product layer: a **deterministic** labeler + handoff/receipt generator + CLI +
OKF export + the `web/` demo. Zero runtime dependencies, ESM JavaScript, Node ≥20. It renders the
`witness-input.json` that `lyhna-mcp-proxy` produces into the user-readable AI Work Receipt.

## Hard invariants (do not violate without project-owner sign-off)

1. **Honesty ceiling (the moat).** Lyhna only asserts *action-level witnessed truth* — what crossed the
   tool boundary vs. what the agent claimed. No surface may imply delivery, business/legal correctness,
   agent confidence as evidence, "live" witnessing, or universal hallucination detection. See `THESIS.md`.
2. **Determinism.** No clock, no model calls, no randomness in `src/`. Identical input ⇒ byte-identical
   output. This is what the drift gates and the byte-for-byte tests enforce.
3. **Regenerate, don't hand-edit, the committed artifacts.** The receipts in `examples/*` and
   `web/data/handoff.js` are generated. After any labeler/generator/receipt change, run the relevant
   `demo*` script(s) **and** `node web/build-data.mjs`, then commit the regenerated output — CI's
   `examples/` drift gate and `test/web-data.test.mjs` fail otherwise.
4. **No overclaim on the website.** `web/` is now a multi-page marketing site (homepage, demo, install,
   pricing — see `LLM-CONTEXT.md` §5). The honesty ceiling applies to **all** marketing copy, not just
   the demo: action-level only; prefer "what crossed the tool boundary"; **PAM-shaped** (never
   "PAM-compatible"); **no pricing numbers** and **no open/one-command install claim** until they are
   real/approved; kill-list scrubbed (no gate/authority/governance/judgment-ledger/binding/SDK on buyer
   surfaces). `demo.html` **replays** a committed receipt with simulated tools — keep the "Demo tools.
   Real witness loop. Deterministic receipt rules." / "demo scenario, replay" framing honest.

## Commands

```bash
npm test                 # node --test — full suite (~70)
npm run demo             # regenerate examples/hermes-zapier  (also: demo:live, demo:real, demo:gmail)
npm run demo:live-loop   # regenerate examples/live-loop (the canonical, loop-produced receipt)
node web/build-data.mjs  # regenerate web/data/handoff.js from examples/live-loop/handoff.json
```

## Shipping changes

One logical change per PR → mark ready → comment `@codex review`. Merge only when CI is green, the PR is
mergeable, Codex says "no major issues" on the current head, and all review threads are resolved; then
squash-merge. Full workflow in `LLM-CONTEXT.md` §8.
