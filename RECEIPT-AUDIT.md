# Lyhna Receipt Audit

> Lane 3 of "testing in earnest." Two independent adversarial auditors read the rendered dogfood
> receipts (HANDOFF.md + handoff.json + next-ai-prompt.md + OKF + PAM) and were asked one question:
> **"Does this receipt overclaim what Lyhna witnessed?"** Run 2026-06-15.

**Reviewers:** two independent Claude-based adversarial auditors (one on the SAFE/SUPPORTED loops + their
exports, one on the FAILURE/MISMATCH/APPROVAL loops + exports), plus the Codex GitHub reviewer on the
code PRs. (Gemini/ChatGPT were not available as tools in this environment; noted for honesty.)

## Headline: no P1, no confirmed P2 truth break

Across all 10 dogfood loops and their OKF/PAM exports, **no auditor could produce a truth break.** Every
flagged loop fails safe; no claimed-but-unwitnessed, mismatched, or blocked action reads as a supported
fact in any surface. Specifically verified clean:
- **"(ok)" / SUPPORTED** is the witness's "the call returned" marker, never a restatement of the agent's
  claimed result; SUPPORTED is consistently scoped to "the agent's account matches what the witness
  observed," never "the work succeeded/correct."
- **Blocked calls** (REFUSED/ESCALATED, loop 05) are narrated "blocked before it ran … the tool did not
  execute" — never as having run. (This is the reliability-gauntlet fix holding under real loops.)
- **Out-of-order stress (09)** fails safe: the unwitnessed user-facing email is never laundered to
  "sent" anywhere; the run is not-safe.
- **Continuation (08-b)** treats the newly-witnessed send as supported without inheriting agent A's
  unsupported claim, and explicitly hedges: "Witnessing is action-level — Lyhna does not witness
  'safety' itself."
- **Every PAM memory item carries an `evidence_status`**; manifests mirror the receipt verdict; the
  `honesty_ceiling` block lists "that a claimed-but-unwitnessed action happened (e.g. an email was sent)"
  under `never_asserts`. Every PAM `Fact:` line is either a genuinely witnessed fact (systems touched,
  not-safe status) or explicitly prefixed "Fact (claim not confirmed by the witness):".
- No claimless step is narrated as "the agent claimed"; no "live"/real-time witnessing implication.

## Findings (hardening notes — not truth breaks)

### N1 — `settled` / "Treat these as SETTLED" carry operator content without an explicit witness boundary (P2/P3)
The continuation-state `settled` strings (operator/agent-declared, e.g. "module formatted + lint clean",
"checkout rounding patched") render in HANDOFF.md `## Settled Decisions` and next-ai-prompt
("Treat these as SETTLED — do not re-litigate") **without** the "(not witnessed by Lyhna)" boundary that
PAM carries (PAM tags them `evidence_status: SETTLED`). The witness is content-blind, so e.g. "lint clean"
is exactly the kind of outcome it cannot verify.
- **Assessment:** the section is headed "Settled **Decisions**" (decision-language, distinct from the
  witness-finding sections "Supported Work" / "Mismatches"), and PAM bounds it explicitly — so this is a
  boundary-*clarity* gap, not a laundering break. It does not assert "Lyhna witnessed X."
- **Decision:** documented, not auto-changed. "## Settled Decisions" is a canonical THESIS §8 section;
  tightening its human-facing wording (e.g. "Settled by the operator — not witnessed by Lyhna") is a
  receipt-voice change worth owner sign-off rather than an autonomous churn. Recommended as a small,
  honesty-positive follow-up if the owner wants it.

### N2 — OKF/PAM step *titles* use the claimed action (P3)
A step's OKF frontmatter `title` is the *claimed* action (e.g. "Step 2 — gmail.send" even when the
witness saw `test_runner` or `create_draft`). The body immediately renders "Agent claimed … / Witness
observed …", so nothing is laundered, but a skim of only the title/`witnessed_action` frontmatter could
momentarily mislead. Suggested (optional): qualify the title, e.g. "Step 2 — claimed gmail.send".

### N3 — `user_facing:true` send on a content-blind SUPPORTED (P3)
On an outbound client email that is genuinely witnessed sent (08-b), the only delta between "the call
returned" and "the client received it" is the quoted claim vs. "(ok)". It is rendered correctly (Lyhna
never claims delivery), but `user_facing:true` is the highest-stakes claim type; an optional micro-
disclaimer ("witnessed that the send call returned; delivery/receipt not witnessed") would harden it.

## Disposition
Per the phase rule ("fix only truth problems, not taste"), **no receipt code was changed from this audit**
— there were no truth problems to fix. N1–N3 are recorded as honesty-hardening candidates; N1 is the only
one worth a deliberate decision (owner's call on canonical receipt voice).
