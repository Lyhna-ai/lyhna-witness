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
npm test     # 14 tests, node:test, no install needed (Node >= 20)
npm run demo # the Hermes/Zapier "claimed Google, used Zapier" demo
```

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
src/labels.mjs      deterministic per-step trust labels (claimed vs. actual)
src/generate.mjs    build witnessed-handoff/v1 + render HANDOFF.md / next-ai-prompt.md
src/index.mjs       public surface
test/               node:test suite (14 tests)
demo/hermes-zapier.mjs   the brutal demo
examples/hermes-zapier/  committed sample output (HANDOFF.md, handoff.json, next-ai-prompt.md)
```

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
