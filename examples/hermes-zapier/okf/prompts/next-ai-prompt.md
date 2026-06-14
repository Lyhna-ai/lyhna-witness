---
type: "Lyhna Safe Continuation Prompt"
title: "Safe Continuation Prompt: hermes-zapier"
description: "Machine-readable handoff for the next agent, marked safe or not-safe to continue."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "next-ai-prompt"
lyhna_schema: "witnessed-handoff/v1"
safe_to_continue: false
handoff_resource: "../handoffs/hermes-zapier.md"
---

# Safe Continuation Prompt

Continuation handoff for [Witnessed Handoff: Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.](../handoffs/hermes-zapier.md).

**Objective:** Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.

Treat these as SETTLED — do not re-litigate unless new evidence appears:
- Client onboarding template v2 is the agreed format.
- The onboarding format — already agreed with the client.

**Status:** NOT safe to send/continue until the unverified steps and any required approvals are resolved.

These steps are UNVERIFIED by the tool-call witness — do not assume they happened, and do not tell anyone they are done until confirmed:
- [Step 1](../steps/step-001.md): The agent said it used google_docs directly, but the witness saw it routed through zapier (zapier → google_docs.create_document). Same end app or not, the path you were told is not the path it took.
- [Step 2](../steps/step-002.md): The agent claimed a "share_with_client" action in google_drive, but the witness saw no tool call for this step — there is no evidence it actually happened.

These steps REQUIRE HUMAN APPROVAL before anyone proceeds — do not act on them yourself:
- _(none)_

**Open questions:**
- Should the client get edit access or view-only?

**Next actions:**
- Confirm the document was actually shared before telling the client it is ready.

**Proof / references** — carry these forward so the vouched-for work stays verifiable:
- _(none)_
