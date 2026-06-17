# AI Work Receipt Capsule — agent-team

> This capsule is what a single witnessed run produces. It is Lyhna's testimony — what crossed
> the tool boundary vs. what the agent claimed — not the agent's self-report. Start with the
> receipt (`HANDOFF.md`); this index explains every file and the trust boundary it carries.

**Verdict:** ⛔ NOT safe to continue / send yet — see the receipt.

**What this means:** 3 of 4 claimed steps are not backed by witnessed evidence (unconfirmed or mismatched). Don't treat the work as done — or send anything to a client — until you've checked the flagged steps in `HANDOFF.md`.

**Objective:** Prepare and send the Q2 client report (parent agent dispatched a research and a writer subagent).

**Summary:** 4 steps · 1 supported · 1 mismatch · 3 unsupported · 2 do-not-send
_Counts can overlap — a step may carry more than one flag — so they need not add up to the step total._

## Agents witnessed
_Attributed from captured evidence only — an agent whose tool path was not routed through Lyhna does not appear._
- **research agent** (`research-1`) — steps 1, 2 — ⚠ not all supported — branch status: unsupported
- **writer agent** (`writer-1`) — step 3 — ⚠ not all supported — branch status: unsupported
- **parent agent** (`orchestrator-1`) — step 4 — ⚠ not all supported — branch status: unsupported

## What's in this capsule

**You only need `HANDOFF.md`** (and this index). The rest are machine-readable copies of the same receipt.

| File | What it is | For | Trust boundary | Description |
| --- | --- | --- | --- | --- |
| `CAPSULE.md` | Capsule index (start here) | human | capsule-index | Human-readable table of contents for this capsule: what each file is and the trust boundary it carries. |
| `capsule.json` | Capsule manifest | machine | capsule-index | Machine-readable manifest of this capsule's artifacts, verdict, and honesty ceiling. |
| `HANDOFF.md` | The AI Work Receipt (readable) | human | witnessed-receipt | What the agent claimed vs. what the witness saw cross the tool boundary, what is supported, what is unsupported or mismatched, and what is safe to continue. |
| `handoff.json` | The AI Work Receipt (machine) | machine | witnessed-receipt | The same receipt as structured data: per-step claimed/witnessed pairs, deterministic trust labels, and the run summary. |
| `next-ai-prompt.md` | Continuation prompt | agent | witnessed-continuation | A safe-continuation handoff for the next human or AI: unverified steps to confirm, approvals required, and what not to re-litigate. |
| `okf/` | OKF knowledge bundle | knowledge-system | carrier-projection | Portable Open-Knowledge-Format projection of the receipt — every step and label travels with its evidence boundary intact. |
| `pam/` | PAM-shaped memory bundle | memory-system | carrier-projection | PAM-shaped memory projection of the receipt — every memory item carries its evidence_status, so an unsupported claim is never upgraded into a fact. |

## Trust boundaries

- **capsule-index** — Tool-generated description of this bundle. Not witnessed evidence and asserts nothing about the work.
- **witnessed-receipt** — Claimed-vs-witnessed receipt. Action-level witnessed truth; the Settled / Do-Not-Re-Litigate sections are operator-declared, not witnessed by Lyhna.
- **witnessed-continuation** — Continuation handoff derived from the receipt. Carries the same witnessed verdicts and operator-declared context — adds no new claim.
- **carrier-projection** — Portable projection in a carrier format. A carrier proves transport (the bundle was not altered), not origin; every item still carries its Lyhna evidence label, so an unsupported claim stays unsupported.

## What this capsule does and does not assert

Lyhna witnesses action-level only — what crossed the tool boundary vs. what the agent claimed. It never asserts:

- that a claimed-but-unwitnessed action happened (e.g. an email was sent)
- business / legal / quality correctness of the work
- client or third-party behavior
- anything outside the observed workflow
- agent confidence as evidence

---
_Lyhna is the independent witness in the agent's tool-call path. This capsule is a portable export; the source of truth remains the witnessed event sequence, the deterministic labels, `handoff.json`, and the proof spine._
