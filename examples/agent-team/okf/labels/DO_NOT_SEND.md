---
type: "Lyhna Trust Label"
title: "DO_NOT_SEND"
description: "Do not send or act on this outward — a user-facing step with no supporting evidence."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "trust-label"
lyhna_schema: "witnessed-handoff/v1"
lyhna_labels:
  - "DO_NOT_SEND"
step_count: 2
handoff_resource: "../handoffs/agent-team.md"
---

# DO_NOT_SEND

Do not send or act on this outward — a user-facing step with no supporting evidence.

## Steps carrying this label
- [Step 3](../steps/step-003.md): The agent claimed a "send" action, but the witness saw "create_draft". What it did or got back does not match what the witness observed.
- [Step 4](../steps/step-004.md): The agent claimed a "post_message" action in slack, but the witness saw no tool call for this step — there is no evidence it actually happened.

Part of [Witnessed Handoff: Prepare and send the Q2 client report (parent agent dispatched a research and a writer subagent).](../handoffs/agent-team.md).
