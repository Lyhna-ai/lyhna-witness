// Lyhna Witness — witnessed-handoff generator.
//
// Turns a witness run (objective + a sequence of {claimed, witnessed} steps + continuation state)
// into the witnessed-handoff/v1 object, then renders the human HANDOFF.md and the machine
// next-ai-prompt.md. Deterministic: no clock, no model calls — given the same input it emits the
// same output (golden-testable). See BUILD-PLAN.md §2.

import { TRUST_LABELS, computeStepLabels } from "./labels.mjs";

export const WITNESSED_HANDOFF_SCHEMA = "witnessed-handoff/v1";

/**
 * @param {object} run
 * @param {string} run.objective
 * @param {Array<object>} run.steps   each: { claimed?, witnessed?, needs_human_approval?, user_facing? }
 * @param {string[]} [run.settled]
 * @param {string[]} [run.open_questions]
 * @param {string[]} [run.next_actions]
 * @param {string[]} [run.do_not_re_litigate]
 * @param {object|null} [run.proof_refs]
 * @returns {object} witnessed-handoff/v1
 */
export function buildWitnessedHandoff(run) {
  const L = TRUST_LABELS;
  const steps = (run.steps ?? []).map((s, i) => computeStepLabels({ ...s, index: i }));

  const has = (step, label) => step.labels.includes(label);
  const needs_human_approval = steps.filter((s) => has(s, L.NEEDS_HUMAN_APPROVAL)).map((s) => s.index);
  const mismatches = steps.filter((s) => has(s, L.CLAIMED_ACTUAL_MISMATCH)).map((s) => s.index);
  const unsupported = steps.filter((s) => has(s, L.UNSUPPORTED)).map((s) => s.index);
  const do_not_send = steps.filter((s) => has(s, L.DO_NOT_SEND)).map((s) => s.index);

  // SAFE_TO_CONTINUE is honest and conservative: not safe if anything is flagged DO_NOT_SEND, if
  // any step is UNSUPPORTED, or if any step still NEEDS_HUMAN_APPROVAL — the next AI must not proceed
  // past a step a human has to sign off on. Mismatches alone surface a review note but do not by
  // themselves block continuation (the route differed; the work may still be fine).
  const safe_to_continue =
    do_not_send.length === 0 && unsupported.length === 0 && needs_human_approval.length === 0;

  return {
    schema: WITNESSED_HANDOFF_SCHEMA,
    objective: run.objective ?? "",
    steps,
    // Include the wrapped business app, not just the outer route: a `zapier → google_docs` call
    // records BOTH "zapier" and "google_docs", so this human-facing inventory does not under-report
    // the system the witness actually saw touched underneath a wrapper family.
    systems_touched: [
      ...new Set(steps.flatMap((s) => [s.witnessed?.system, s.witnessed?.app]).filter(Boolean))
    ],
    summary: {
      total_steps: steps.length,
      supported: steps.filter((s) => has(s, L.SUPPORTED)).length,
      mismatches: mismatches.length,
      unsupported: unsupported.length,
      do_not_send: do_not_send.length
    },
    settled: run.settled ?? [],
    open_questions: run.open_questions ?? [],
    next_actions: run.next_actions ?? [],
    needs_human_approval,
    do_not_re_litigate: run.do_not_re_litigate ?? [],
    safe_to_continue,
    proof_refs: run.proof_refs ?? null
  };
}

const bullet = (items) => (items.length ? items.map((x) => `- ${x}`).join("\n") : "_(none)_");

function stepLine(s) {
  const claimed = s.claimed
    ? `${s.claimed.action ?? "step"}${s.claimed.system ? ` in ${s.claimed.system}` : ""}`
    : "(no claim)";
  const witnessed = s.witnessed
    ? `${s.witnessed.system ?? "?"}${s.witnessed.app ? ` → ${s.witnessed.app}` : ""}${
        s.witnessed.action ? `.${s.witnessed.action}` : ""
      } (${s.witnessed.result ?? (s.witnessed.returned === false ? "no result" : "ok")})`
    : "nothing observed";
  return `- **Step ${s.index + 1}** \`${s.labels.join(" ")}\`\n  - Agent claimed: ${claimed}\n  - Witness saw: ${witnessed}\n  - ${s.human_note}`;
}

/** Render the human-facing HANDOFF.md (THESIS.md §8 section order). */
export function renderHandoffMarkdown(h) {
  const L = TRUST_LABELS;
  const by = (label) => h.steps.filter((s) => s.labels.includes(label));
  const verdict = h.safe_to_continue
    ? "✅ Safe to continue."
    : "⛔ NOT safe to continue / send yet — see flags below.";

  return [
    `# Witnessed Handoff`,
    ``,
    `> What your agent actually did — from the tool-call witness, not the agent's self-report.`,
    ``,
    `**${verdict}**  ·  ${h.summary.total_steps} steps · ${h.summary.supported} supported · ` +
      `${h.summary.mismatches} mismatch · ${h.summary.unsupported} unsupported · ${h.summary.do_not_send} do-not-send`,
    ``,
    `## Current Objective`,
    h.objective || "_(none stated)_",
    ``,
    `## Claimed vs. Actual Summary`,
    h.steps.length ? h.steps.map(stepLine).join("\n") : "_(no steps)_",
    ``,
    `## Systems Touched`,
    bullet(h.systems_touched),
    ``,
    `## Supported Work`,
    bullet(by(L.SUPPORTED).map((s) => `Step ${s.index + 1}: ${s.human_note}`)),
    ``,
    `## Unsupported or Missing Evidence`,
    bullet(
      by(L.UNSUPPORTED)
        .concat(by(L.NEEDS_EVIDENCE).filter((s) => !s.labels.includes(L.UNSUPPORTED)))
        .map((s) => `Step ${s.index + 1}: ${s.human_note}`)
    ),
    ``,
    `## Mismatches`,
    bullet(by(L.CLAIMED_ACTUAL_MISMATCH).map((s) => `Step ${s.index + 1}: ${s.human_note}`)),
    ``,
    `## Settled Decisions`,
    bullet(h.settled),
    ``,
    `## Do Not Re-Litigate`,
    bullet(h.do_not_re_litigate),
    ``,
    `## Open Questions`,
    bullet(h.open_questions),
    ``,
    `## Human Approval Needed`,
    bullet(
      by(L.DO_NOT_SEND)
        .map((s) => `Step ${s.index + 1}: ${s.human_note}`)
        .concat(h.needs_human_approval.map((i) => `Step ${i + 1}: routed for human approval`))
    ),
    ``,
    `## Next Actions`,
    bullet(h.next_actions),
    ``,
    `## Safe Continuation`,
    h.safe_to_continue
      ? `Safe to continue from this state. The next human or AI may proceed.`
      : `Do not continue or send to anyone until the flagged steps above are resolved.`,
    ``,
    `---`,
    `_Lyhna witnesses what crossed the tool boundary and compares it to the agent's claims. It does ` +
      `not judge whether the work was good, and does not verify outcomes outside the observed path._`,
    ``
  ].join("\n");
}

/** Render the machine-facing next-ai-prompt.md (THESIS.md §15 shape, parameterized with this run). */
export function renderNextAiPrompt(h) {
  return [
    `You are continuing work from a Lyhna Witnessed Handoff.`,
    ``,
    `Objective: ${h.objective || "(none stated)"}`,
    ``,
    `Treat these as SETTLED — do not re-litigate unless new evidence appears:`,
    bullet(h.settled.concat(h.do_not_re_litigate)),
    ``,
    `These steps are UNVERIFIED by the tool-call witness — do not assume they happened, and do not`,
    `tell anyone they are done until confirmed:`,
    bullet(
      h.steps
        .filter((s) => s.labels.includes("UNSUPPORTED") || s.labels.includes("CLAIMED_ACTUAL_MISMATCH"))
        .map((s) => `Step ${s.index + 1}: ${s.human_note}`)
    ),
    ``,
    `Open questions:`,
    bullet(h.open_questions),
    ``,
    `Start from these next actions:`,
    bullet(h.next_actions),
    ``,
    h.safe_to_continue
      ? `Safe to continue.`
      : `NOT safe to send/continue until the unverified steps above are confirmed.`,
    ``
  ].join("\n");
}
