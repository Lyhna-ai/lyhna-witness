---
type: "Lyhna Trust Label"
title: "UNSUPPORTED"
description: "A claimed or observed step the witness could not confirm as successful — no supporting tool evidence, or the call did not return."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "trust-label"
lyhna_schema: "witnessed-handoff/v1"
lyhna_labels:
  - "UNSUPPORTED"
step_count: 3
handoff_resource: "../handoffs/agent-team.md"
---

# UNSUPPORTED

A claimed or observed step the witness could not confirm as successful — no supporting tool evidence, or the call did not return.

## Steps carrying this label
- [Step 2](../steps/step-002.md): The agent claimed a "read_file" action in filesystem, but the witness saw no tool call for this step — there is no evidence it actually happened.
- [Step 3](../steps/step-003.md): The agent claimed a "send" action, but the witness saw "create_draft". What it did or got back does not match what the witness observed.
- [Step 4](../steps/step-004.md): The agent claimed a "post_message" action in slack, but the witness saw no tool call for this step — there is no evidence it actually happened.

Part of [Witnessed Handoff: Prepare and send the Q2 client report (parent agent dispatched a research and a writer subagent).](../handoffs/agent-team.md).
