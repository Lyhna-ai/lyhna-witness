---
type: "Lyhna Witnessed Handoff"
title: "Witnessed Handoff: Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email."
description: "What the agent actually did vs. what it claimed — NOT safe to continue."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
lyhna_schema: "witnessed-handoff/v1"
safe_to_continue: false
summary_total_steps: 3
summary_supported: 1
summary_mismatches: 1
summary_unsupported: 1
summary_do_not_send: 1
lyhna_labels:
  - "CLAIMED_ACTUAL_MISMATCH"
  - "DO_NOT_SEND"
  - "NEEDS_EVIDENCE"
  - "SUPPORTED"
  - "UNSUPPORTED"
handoff_resource: "hermes-zapier.md"
---

# Witnessed Handoff: Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.

> Lyhna is the independent witness in the tool-call path. This is its testimony — not the agent's self-report.

**Verdict:** ⛔ NOT safe to continue / send yet.

**Objective:** Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.

**Summary:** 3 steps · 1 supported · 1 mismatch · 1 unsupported · 1 do-not-send

## Claimed vs. Actual (by step)
- [Step 1](../steps/step-001.md) `CLAIMED_ACTUAL_MISMATCH` — claimed create_document in google_docs; witness saw zapier → google_docs.create_document (created)
- [Step 2](../steps/step-002.md) `UNSUPPORTED NEEDS_EVIDENCE DO_NOT_SEND` — claimed share_with_client in google_drive; witness saw nothing observed
- [Step 3](../steps/step-003.md) `SUPPORTED` — claimed send_confirmation in gmail; witness saw gmail.send_confirmation (sent)

## Systems Touched
- zapier
- google_docs
- gmail

## Trust Labels Present
- [CLAIMED_ACTUAL_MISMATCH](../labels/CLAIMED_ACTUAL_MISMATCH.md)
- [DO_NOT_SEND](../labels/DO_NOT_SEND.md)
- [NEEDS_EVIDENCE](../labels/NEEDS_EVIDENCE.md)
- [SUPPORTED](../labels/SUPPORTED.md)
- [UNSUPPORTED](../labels/UNSUPPORTED.md)

## Safe Continuation
See [the safe-continuation prompt](../prompts/next-ai-prompt.md) for the machine-readable handoff to the next agent.

---
_OKF is the container; Lyhna is the witness. This bundle is a portable export — the source of truth remains the witnessed event sequence, the deterministic labels, handoff.json, and the proof spine._
