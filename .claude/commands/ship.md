---
description: Run the full ship loop — plan → Codex plan-review → implement → PR → Codex diff-review → adversarial subagent review → green merge.
argument-hint: <goal, or path to a spec / PLAN.md>
---

Ship this as a reviewed loop, not a one-shot: $ARGUMENTS

Honor the fence already in context (AGENTS.md / LLM-CONTEXT.md): Lyhna is an
independent witness, action-level truth only, determinism absolute — no clock,
no model calls, no randomness in receipt/export paths. If a change would touch
receipt/capsule semantics, signing, canonicalization, labels, or verifier
behavior, stop and flag it before going further.

Run these gates in order. Don't skip ahead; don't batch review to the end.

1. PLAN (plan mode)
   - Delegate the investigation to a subagent so your main context stays clean;
     have it report back a summary, not a transcript.
   - Write the plan to PLAN.md: goal, interfaces/files touched, what's explicitly
     out of scope, and the end-to-end check that will prove it works.
   - Define DONE as a command that returns pass/fail. Prefer the strictest
     realistic environment (e.g. clean-room: no repo, no dev-only deps). The
     check is the contract.

2. PLAN REVIEW (cross-model, before any code)
   - Post the plan for Codex: @codex review PLAN.md.
   - Fix approach-level problems now, while they're cheap. Re-post if the
     approach changes materially.

3. IMPLEMENT
   - Work against the plan. Commit checkpoints at each logical step so any bad
     turn is one revert away.
   - Build the DONE check as a real runnable test/script — not a description.

4. PR EARLY + DIFF REVIEW (loop, not a tollbooth)
   - Open the PR as soon as there's a coherent slice. One logical change per PR.
   - @codex review the diff. Iterate on findings on the same branch. Keep it
     moving; don't hold review for the end.

5. ADVERSARIAL REVIEW (fresh context, before you call it done)
   - Use the diff-reviewer agent (or spawn a fresh-context subagent) to review
     the diff against PLAN.md.
   - It flags ONLY gaps that break correctness or a stated requirement — not
     style, not refactors, not nice-to-haves. We are not redecorating.

6. EVIDENCE + SHIP
   - Run the DONE check and paste the command and its real output. Show evidence;
     don't assert success.
   - Update docs to the true state. Don't claim a capability (download, installer,
     delivery) unless a real artifact demonstrates it.
   - Merge only when: CI green, PR mergeable clean, Codex clean on current HEAD,
     all threads resolved.

If the task is genuinely one-line, say so and skip planning — the loop is for
work big enough to be worth reviewing.
