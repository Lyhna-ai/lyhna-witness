---
type: "Lyhna Witnessed Step"
title: "Step 1 — google_docs.create_document"
description: "The agent said it used google_docs directly, but the witness saw it routed through zapier (zapier → google_docs.create_document). Same end app or not, the path you were told is not the path it took."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "step"
lyhna_schema: "witnessed-handoff/v1"
step_index: 1
lyhna_labels:
  - "CLAIMED_ACTUAL_MISMATCH"
claimed_system: "google_docs"
claimed_action: "create_document"
witnessed_system: "zapier"
witnessed_action: "create_document"
handoff_resource: "../handoffs/hermes-zapier.md"
---

# Step 1 — google_docs.create_document

**Agent claimed:** create_document in google_docs → "created"

**Witness observed:** zapier → google_docs.create_document (created)

**Labels:** [CLAIMED_ACTUAL_MISMATCH](../labels/CLAIMED_ACTUAL_MISMATCH.md)

**Note:** The agent said it used google_docs directly, but the witness saw it routed through zapier (zapier → google_docs.create_document). Same end app or not, the path you were told is not the path it took.

Part of [Witnessed Handoff: Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.](../handoffs/hermes-zapier.md).
