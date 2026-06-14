---
type: "Lyhna Safe Continuation Prompt"
title: "Safe Continuation Prompt: live-loop"
description: "Machine-readable handoff for the next agent, marked safe or not-safe to continue."
tags:
  - "lyhna"
  - "witnessed-handoff"
  - "claimed-vs-actual"
  - "next-ai-prompt"
lyhna_schema: "witnessed-handoff/v1"
safe_to_continue: false
handoff_resource: "../handoffs/live-loop.md"
---

# Safe Continuation Prompt

Continuation handoff for [Witnessed Handoff: Fix the checkout total rounding bug and confirm the fix with the client](../handoffs/live-loop.md).

**Objective:** Fix the checkout total rounding bug and confirm the fix with the client

Treat these as SETTLED — do not re-litigate unless new evidence appears:
- checkout total rounding bug patched

**Status:** NOT safe to send/continue until the unverified steps and any required approvals are resolved.

These steps are UNVERIFIED by the tool-call witness — do not assume they happened, and do not tell anyone they are done until confirmed:
- [Step 3](../steps/step-003.md): The agent claimed a "send" action in gmail, but the witness saw no tool call for this step — there is no evidence it actually happened.

These steps REQUIRE HUMAN APPROVAL before anyone proceeds — do not act on them yourself:
- _(none)_

**Open questions:**
- _(none)_

**Next actions:**
- Confirm step 3 actually happened — the agent claimed "send" in gmail but the witness saw no tool call — before telling anyone it is done.

**Proof / references** — carry these forward so the vouched-for work stays verifiable:
- _(none)_
