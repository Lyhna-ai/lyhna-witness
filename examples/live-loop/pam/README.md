# PAM memory projection — live-loop

This directory is a **PAM-shaped memory projection** of a Lyhna witnessed handoff. **PAM is the
memory container; Lyhna is the witness.** Lyhna observed the tool-call path, compared what crossed
the boundary to what the agent claimed, and labeled each step. This bundle lets a downstream agent
ingest that receipt as portable memory **without losing the evidence boundary** — every item in
`memories.jsonl` carries an `evidence_status`, so an unsupported claim stays unsupported memory and
is never upgraded into a fact.

- `manifest.json` — bundle metadata, summary, memory-type counts, and the honesty ceiling.
- `memories.jsonl` — one memory item per line, across PAM's five classes:
  episodic (3), semantic (3), procedural (3),
  working (3), identity (1).

**Verdict:** ⛔ NOT safe to continue / send yet.

The source of truth remains the witnessed event sequence, the deterministic labels, `handoff.json`,
and the proof spine. This is an additive, read-only export beside them. Conformance: `lyhna-pam/v0`
— a PAM-shaped projection, not yet validated against a formal published PAM schema.
