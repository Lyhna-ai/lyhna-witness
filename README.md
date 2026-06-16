# Lyhna Witness

**Lyhna is the independent witness in the path of an agent's real-world tool calls.** It records
what actually crossed the wire, compares it to what the agent claimed, and produces a trustworthy
handoff of what the agent really did. Not authority. Not memory. Not a summary generator.

> The agent is an unreliable witness to its own work. Lyhna is the independent witness in the
> tool-call path, and the Handoff is its testimony.

## The documents

| File | What it is |
|---|---|
| [`THESIS.md`](./THESIS.md) | The product decision, **canonical & verbatim**. Read first. Do not edit. |
| [`BUILD-PLAN.md`](./BUILD-PLAN.md) | Code-grounded build: existing assets to read, net-new work, MVP schema, autonomy loop. |
| [`HUMAN-GUIDE.md`](./HUMAN-GUIDE.md) | For the founder: how the loop runs, your part, carrying this into Codex/LLM projects. |
| [`PROJECT-BRIEF.md`](./PROJECT-BRIEF.md) | Portable, paste-as-first-instruction brief (with an anti-authority guardrail) for new projects. |

## MVP (BUILD-PLAN slices 1–4) — runnable now, zero dependencies

A deterministic generator turns a tool-call event sequence (what the agent **claimed** + what the
witness **observed**) into a trust-marked handoff: `HANDOFF.md`, `handoff.json`, `next-ai-prompt.md`.
Labels are computed by fixed rules — `SUPPORTED`, `CLAIMED_ACTUAL_MISMATCH`, `UNSUPPORTED`,
`NEEDS_EVIDENCE`, `DO_NOT_SEND`, `NEEDS_HUMAN_APPROVAL`, … — never by a model's opinion. That
determinism is the trust.

```bash
npm test     # node:test, no install needed (Node >= 20)
npm run demo # the Hermes/Zapier "claimed Google, used Zapier" demo
```

### Render a receipt from a capture (CLI)

Given a `witness-input.json` (the proxy emits one at loop close; see `lyhna-mcp-proxy`), render the
receipt with the zero-dependency CLI:

```bash
node src/cli.mjs <witness-input.json> <outDir>            # writes HANDOFF.md, handoff.json, next-ai-prompt.md
node src/cli.mjs <witness-input.json> <outDir> --okf --pam  # ALSO write the OKF and PAM bundles
node src/cli.mjs <witness-input.json> <outDir> --gate       # exit 3 when NOT safe_to_continue (fail-closed)
node src/cli.mjs - <outDir>                                 # read the capture from stdin
```

`--okf` / `--pam` are additive — without them you get exactly the handoff trio. Each export is a
deterministic projection of the same handoff (every OKF step / PAM item carries the receipt's evidence
labels), so a downstream knowledge/memory system inherits the honesty ceiling instead of stripping it.

The demo reproduces the real failure on purpose: the agent reports a clean story; the witness saw
something different. See the committed output in [`examples/hermes-zapier/`](./examples/hermes-zapier/) —
`HANDOFF.md` is the human face, readable without running anything. The demo flags two things a
business owner must see:

- **Step 1 — `CLAIMED_ACTUAL_MISMATCH`:** agent said Google Docs directly; witness saw it routed
  through Zapier.
- **Step 2 — `DO_NOT_SEND`:** agent said it shared the doc with the client; the witness saw **no
  tool call** — no evidence it happened. Do not tell the client it's ready.

### Layout

```
src/labels.mjs           deterministic per-step trust labels (claimed vs. actual)
src/generate.mjs         build witnessed-handoff/v1 + render HANDOFF.md / next-ai-prompt.md
src/witnessed-event.mjs  adapter: proxy event vocabulary (wrapper call + verdict + runtime report) → step
src/index.mjs            public surface
test/                    node:test suite
demo/hermes-zapier.mjs        the brutal demo (hand-authored witnessed side)
demo/zapier-google-witness.mjs   the same catch, driven by proxy-shaped events
examples/                committed sample output (HANDOFF.md, handoff.json, next-ai-prompt.md)
```

## Wiring to real witnessed events (BUILD-PLAN slice 5)

`src/witnessed-event.mjs` is the bridge from the proxy's real event vocabulary to the labeler.
It mirrors the frozen wrapper-registry (`lyhna-mcp-proxy/src/extractors/wrapper-registry.ts`) to
crack a wrapper call (`execute_zapier_<app>_action`) open into its true `zapier.<app>.<action>`, and
maps the judgment-ledger `verdict` (APPROVED/ESCALATED/REFUSED) + `runtime_report`
(`returned` / `result_hash` / `error_hash`) into the witnessed half of a step. The agent's **claim**
(`record_claim` — net-new, since the content-blind proxy never stores it) is supplied alongside.

```bash
npm run demo:live  # the Zapier/Google catch, built from proxy-shaped events (not hand-authored)
```

On a successful call the witness records only `returned: true` (+ the result hash) — it does **not**
invent a semantic result (`"sent"`, `"created"`), because it did not observe one. That restraint is
the V1 line in code: witness what crossed the boundary; never fabricate what you didn't see.

## OKF-compatible export (a portable projection)

Lyhna can emit a witnessed handoff as an **OKF-compatible bundle** — [Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/),
a portable directory of markdown files with YAML frontmatter — beside the existing outputs:

```
examples/hermes-zapier/
  HANDOFF.md  handoff.json  next-ai-prompt.md
  okf/
    index.md  log.md
    handoffs/hermes-zapier.md      # type: Lyhna Witnessed Handoff
    steps/step-001.md …            # type: Lyhna Witnessed Step
    labels/CLAIMED_ACTUAL_MISMATCH.md …   # type: Lyhna Trust Label
    prompts/next-ai-prompt.md      # type: Lyhna Safe Continuation Prompt
```

`renderOkfBundle(handoff, options)` returns the bundle as a `{ path: contents }` map. Emit it from the
CLI with `--okf` (writes `<outDir>/okf/`), or call the function directly. It is deterministic — no clock,
no model calls; a `timestamp` appears only if you pass one in `options`. Frontmatter carries the witness
facts the format should preserve:
`safe_to_continue`, `lyhna_labels`, the mismatch / unsupported / do-not-send counts, and `proof_refs`.

**OKF is the container; Lyhna is the witness.** The bundle is a *portable export* for agents, repos,
catalogs, and knowledge systems — it is **not** the source of truth. The source of truth remains the
witnessed event sequence, the deterministic trust labels, `handoff.json`, and the proof spine. OKF can
carry knowledge; Lyhna is what tells you which agent claims are supported, unsupported, mismatched, or
unsafe to continue.

## PAM-shaped memory projection

Beside OKF, Lyhna emits the same witnessed handoff as a **PAM-shaped memory bundle** — PAM (Portable
Agent Memory) is the format agents use to carry memory/continuation state between systems:

```
examples/live-loop/
  HANDOFF.md  handoff.json  next-ai-prompt.md
  okf/        # knowledge bundle
  pam/        # memory projection
    manifest.json     # schema, summary, memory-type counts, honesty ceiling
    memories.jsonl    # one memory item per line, across PAM's five classes
    README.md
```

`renderPamBundle(handoff, options)` returns a `{ path: contents }` map. Emit it from the CLI with
`--pam` (writes `<outDir>/pam/`), or call the function directly. Deterministic — no clock, no model
calls; a `timestamp` appears (manifest only) solely if you pass one. The receipt projects across PAM's five memory classes: **episodic** (the witnessed steps),
**semantic** (evidence-bound facts), **procedural** (continuation rules / do-not-send / do-not-re-litigate),
**working** (objective, open questions, settled, continuation state), and **identity** (explicit
user/org/client preferences only — never inferred; clearly absent otherwise).

**PAM is the memory container; Lyhna is the witness.** The distinction is transport integrity vs.
origin integrity: a memory format proves a bundle was not altered; it cannot prove the contents reflect
work that happened. So **every memory item carries its `evidence_status`** (`SUPPORTED`, `UNSUPPORTED`,
`DO_NOT_SEND`, `CLAIMED_ACTUAL_MISMATCH`, …). A downstream agent therefore *inherits* the honesty
ceiling instead of stripping it: an unsupported claim stays unsupported memory and is never upgraded
into a fact. (Conformance: `lyhna-pam/v0` — a PAM-shaped projection, validated against the Portable AI
Memory v1.0 schema and found non-conformant; it is a projection, not a conformant PAM document. See
[`PAM-SCHEMA-VALIDATION.md`](./PAM-SCHEMA-VALIDATION.md).)

## V1 promise (the honesty ceiling)

Action-level witness + evidence-bound continuation. Lyhna witnesses what crossed the boundary and
compares it to claims. It does **not** claim to catch every hallucination, judge whether the work
was good, or verify outcomes outside the observed path. See `THESIS.md` §6.

## Provenance

The witness mechanism is not greenfield: the proven engine in `lyhna-mcp-proxy` already resolves
universal wrapper calls (e.g. Zapier `execute_zapier_*_action`) to their true `app.action`
(`src/extractors/wrapper-registry.ts`) — the mechanism that catches "claimed Google, used Zapier."
This repo is the product layer on top: capture the agent's **claim** and emit the trust-marked
handoff. It does not modify the proxy, the receipt shape, or the proof spine.
