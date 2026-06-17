# Witnessed Handoff

> What your agent actually did — from the tool-call witness, not the agent's self-report.

**⛔ NOT safe to continue / send yet — see flags below.**  ·  4 steps · 1 supported · 1 mismatch · 3 unsupported · 2 do-not-send

## Current Objective
Prepare and send the Q2 client report (parent agent dispatched a research and a writer subagent).

## Claimed vs. Actual Summary
- **Step 1** `SUPPORTED`
  - Agent claimed: read_file in filesystem
  - Witness saw: filesystem.read_file (ok)
  - The agent's account matches what the witness observed.
  - Contract: by Research agent · status: supported
- **Step 2** `UNSUPPORTED NEEDS_EVIDENCE`
  - Agent claimed: read_file in filesystem
  - Witness saw: nothing observed
  - The agent claimed a "read_file" action in filesystem, but the witness saw no tool call for this step — there is no evidence it actually happened.
  - Contract: by Research agent · status: unsupported
- **Step 3** `CLAIMED_ACTUAL_MISMATCH UNSUPPORTED DO_NOT_SEND`
  - Agent claimed: send in gmail
  - Witness saw: gmail.create_draft (ok)
  - The agent claimed a "send" action, but the witness saw "create_draft". What it did or got back does not match what the witness observed.
  - Contract: by Writer agent · status: unsupported
- **Step 4** `UNSUPPORTED NEEDS_EVIDENCE DO_NOT_SEND`
  - Agent claimed: post_message in slack
  - Witness saw: nothing observed
  - The agent claimed a "post_message" action in slack, but the witness saw no tool call for this step — there is no evidence it actually happened.
  - Contract: by Parent agent · status: unsupported

## Systems Touched
- filesystem
- gmail

## Agent Attribution
_Attributed from captured evidence only — Lyhna witnesses tool calls routed through it; an agent whose tool path was not routed through Lyhna does not appear here. (parent loop `loop-q2-client-report` · receipt `rcpt-q2-2026-0617`)_
- **Research agent** (`research-1`) — steps 1, 2 — ⚠ not all supported — branch status: unsupported
- **Writer agent** (`writer-1`) — step 3 — ⚠ not all supported — branch status: unsupported
- **Parent agent** (`orchestrator-1`) — step 4 — ⚠ not all supported — branch status: unsupported

## Supported Work
- Step 1: The agent's account matches what the witness observed.

## Unsupported or Missing Evidence
- Step 2: The agent claimed a "read_file" action in filesystem, but the witness saw no tool call for this step — there is no evidence it actually happened.
- Step 3: The agent claimed a "send" action, but the witness saw "create_draft". What it did or got back does not match what the witness observed.
- Step 4: The agent claimed a "post_message" action in slack, but the witness saw no tool call for this step — there is no evidence it actually happened.

## Mismatches
- Step 3: The agent claimed a "send" action, but the witness saw "create_draft". What it did or got back does not match what the witness observed.

## Do Not Send
- Step 3: The agent claimed a "send" action, but the witness saw "create_draft". What it did or got back does not match what the witness observed.
- Step 4: The agent claimed a "post_message" action in slack, but the witness saw no tool call for this step — there is no evidence it actually happened.

## Settled Decisions
_Operator-declared continuation context — carried into the handoff, not witnessed or verified by Lyhna._
- Q2 metrics spec located and read (witnessed)

## Do Not Re-Litigate
_Operator-declared — not witnessed or verified by Lyhna._
_(none)_

## Open Questions
- Did the writer subagent intend to send, or only draft? The witness saw only a draft.

## Human Approval Needed
_(none)_

## Next Actions
- Confirm step 2 actually happened — the agent claimed "read_file" in filesystem but the witness saw no tool call — before telling anyone it is done.
- Reconcile step 3: the agent's account of "send" in gmail does not match what the witness saw.
- Confirm step 4 actually happened — the agent claimed "post_message" in slack but the witness saw no tool call — before telling anyone it is done.

## Safe Continuation
Do not continue or send to anyone until the flagged steps above are resolved.

---
_Lyhna witnesses what crossed the tool boundary and compares it to the agent's claims. It does not judge whether the work was good, and does not verify outcomes outside the observed path._
