# Reliability Gauntlet

An adversarial reliability harness that runs the **full** Lyhna loop into the ground across a matrix of
scenarios and asserts the honesty ceiling holds on every rendered surface. See
[`../RELIABILITY-GAUNTLET.md`](../RELIABILITY-GAUNTLET.md) for the report (objective, matrix, findings,
fixes, remaining risks, verdict).

## Run it

```bash
# from a lyhna-witness checkout with lyhna-mcp-proxy beside it (built):
npm run gauntlet                                  # all 30 scenarios, in category batches
node reliability/run-gauntlet.mjs 3-mismatch      # one category
node reliability/run-gauntlet.mjs --ids c2-email-only,c3-action-mismatch
```

Requires the sibling `lyhna-mcp-proxy` checkout (env `LYHNA_PROXY_DIR`, default `../lyhna-mcp-proxy`)
with its `dist` built — the proxy's `scripts/gauntlet/driver.mjs` drives the real standing-service loop
and emits each `witness-input.json`.

## What's here

- `scenarios.mjs` — the scenario matrix (4 categories) + hand-derived expected labels per step.
- `gauntlet-lib.mjs` — renders the full witness surface (handoff + OKF + PAM) and runs the invariants
  (no false-safe, no laundering, DO_NOT_SEND/approval survive, no fabrication, every PAM item carries an
  `evidence_status`, determinism).
- `run-gauntlet.mjs` — orchestrator: drives the real loop, vendors inputs, renders, asserts, writes
  `results.jsonl`, prints per-category batch summaries.
- `inputs/<id>.json` — the **loop-produced** `witness-input.json` for each scenario (provenance: emitted
  by the real proxy loop, not hand-authored; lets the witness-side assertions be re-rendered in isolation).
- `results.jsonl` — one machine-readable result per scenario (status, findings, step labels, summary).

The harness is intentionally **not** part of `npm test` (it needs the sibling proxy). It is a manual,
reproducible reliability run; `results.jsonl` is the committed record of the latest run.
