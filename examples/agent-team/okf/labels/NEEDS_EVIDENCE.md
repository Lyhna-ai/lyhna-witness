---
type: "Lyhna Trust Label"
title: "NEEDS_EVIDENCE"
description: "Not yet backed by an observed tool call; evidence is required before relying on it."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "trust-label"
lyhna_schema: "witnessed-handoff/v1"
lyhna_labels:
  - "NEEDS_EVIDENCE"
step_count: 2
handoff_resource: "../handoffs/agent-team.md"
---

# NEEDS_EVIDENCE

Not yet backed by an observed tool call; evidence is required before relying on it.

## Steps carrying this label
- [Step 2](../steps/step-002.md): The agent claimed a "read_file" action in filesystem, but the witness saw no tool call for this step — there is no evidence it actually happened.
- [Step 4](../steps/step-004.md): The agent claimed a "post_message" action in slack, but the witness saw no tool call for this step — there is no evidence it actually happened.

Part of [Witnessed Handoff: Prepare and send the Q2 client report (parent agent dispatched a research and a writer subagent).](../handoffs/agent-team.md).
