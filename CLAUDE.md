# CLAUDE.md

**Read [`LLM-CONTEXT.md`](./LLM-CONTEXT.md) first** — it's the dated orientation for this project (what
Lyhna is, the two repos, the claim→witness→receipt loop, what the website does, current state, the
PR/Codex merge gate, and the honesty ceiling). See also [`THESIS.md`](./THESIS.md) (canonical thesis +
honesty ceiling) and [`AGENTS.md`](./AGENTS.md) (this repo's invariants).

Non-negotiable, even before reading the rest:
- **Honesty ceiling:** Lyhna only asserts *action-level witnessed truth*. Never let any surface (receipt,
  web copy, README) imply an outcome was verified, work is correct, an email was sent, or that
  witnessing happened live. That is an overclaim — do not ship it.
- **Determinism:** the labeler/generator (`src/`) must stay deterministic — no clock, no model calls, no
  randomness. Same input ⇒ byte-identical output (the drift gates enforce this).
- **Regenerate artifacts:** after changing the labeler/generator or any receipt, run the `demo*` scripts
  **and** `node web/build-data.mjs`, then commit the output, or CI's drift gate fails.
- **Every change ships as a PR through the gate:** CI green + `mergeable` clean + Codex "no major issues"
  on the current head + zero unresolved review threads, then squash-merge.
