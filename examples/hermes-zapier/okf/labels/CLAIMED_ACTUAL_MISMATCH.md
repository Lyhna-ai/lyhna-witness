---
type: "Lyhna Trust Label"
title: "CLAIMED_ACTUAL_MISMATCH"
description: "What the agent claimed differs from what the witness observed (a different route, action, or result)."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "trust-label"
lyhna_schema: "witnessed-handoff/v1"
lyhna_labels:
  - "CLAIMED_ACTUAL_MISMATCH"
step_count: 1
handoff_resource: "../handoffs/hermes-zapier.md"
---

# CLAIMED_ACTUAL_MISMATCH

What the agent claimed differs from what the witness observed (a different route, action, or result).

## Steps carrying this label
- [Step 1](../steps/step-001.md): The agent said it used google_docs directly, but the witness saw it routed through zapier (zapier → google_docs.create_document). Same end app or not, the path you were told is not the path it took.

Part of [Witnessed Handoff: Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.](../handoffs/hermes-zapier.md).
