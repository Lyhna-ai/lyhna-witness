// Lyhna Witness — witnessed-handoff generator.
//
// Turns a witness run (objective + a sequence of {claimed, witnessed} steps + continuation state)
// into the witnessed-handoff/v1 object, then renders the human HANDOFF.md and the machine
// next-ai-prompt.md. Deterministic: no clock, no model calls — given the same input it emits the
// same output (golden-testable). See BUILD-PLAN.md §2.

import { TRUST_LABELS, computeStepLabels } from "./labels.mjs";
import { buildStepContract, summarizeAgents } from "./contract.mjs";

export const WITNESSED_HANDOFF_SCHEMA = "witnessed-handoff/v1";

const present = (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");

// A run is "contract-enabled" only when it carries a MEANINGFUL claim-to-action spine signal — an agent
// identifier, a claim/turn/call link, an artifact, an explicit/conflicting link basis, or a run-level
// loop/receipt id. The default link_basis ("ordinal"/"unwitnessed"/…) that every step now carries does
// NOT count, so a plain run produces byte-identical output to before (no contract block is attached).
function hasMeaningfulSpine(run) {
  if (present(run.parent_loop_id) || present(run.receipt_id)) return true;
  return (run.steps ?? []).some((s) => {
    const sp = s.spine ?? {};
    return (
      present(sp.agent_id) ||
      present(sp.subagent_role) ||
      present(sp.artifact_id) ||
      present(sp.claim_id) ||
      present(sp.claim_turn_id) ||
      present(sp.turn_ref) ||
      present(sp.call_id) ||
      sp.link_basis === "explicit" ||
      sp.link_basis === "conflict"
    );
  });
}

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
  const contractEnabled = hasMeaningfulSpine(run);
  const steps = (run.steps ?? []).map((s, i) => {
    const labeled = computeStepLabels({ ...s, index: i });
    // Attach the per-step claim-to-action contract only on a contract-enabled run. The contract is a
    // deterministic projection of the label + human_note + supplied identifiers — it adds no new claim.
    if (contractEnabled) labeled.contract = buildStepContract(labeled, s.spine ?? {});
    return labeled;
  });

  const has = (step, label) => step.labels.includes(label);
  const needs_human_approval = steps.filter((s) => has(s, L.NEEDS_HUMAN_APPROVAL)).map((s) => s.index);
  const mismatches = steps.filter((s) => has(s, L.CLAIMED_ACTUAL_MISMATCH)).map((s) => s.index);
  const unsupported = steps.filter((s) => has(s, L.UNSUPPORTED)).map((s) => s.index);
  const do_not_send = steps.filter((s) => has(s, L.DO_NOT_SEND)).map((s) => s.index);

  // SAFE_TO_CONTINUE is honest and conservative: not safe if anything is flagged DO_NOT_SEND, if any
  // step is UNSUPPORTED, if any step still NEEDS_HUMAN_APPROVAL, or if any step is a
  // CLAIMED_ACTUAL_MISMATCH. A mismatch means the agent's account of what it did does not match what
  // the witness observed — so the continuation state is NOT clean and the next human/AI must review and
  // reconcile before proceeding (THESIS §9: "review before sending"). A mismatch does not by itself mean
  // the work failed or must not be sent (those are separate UNSUPPORTED/DO_NOT_SEND labels); it means
  // the handoff is not safe to continue as-is until the claimed-vs-actual gap is reconciled.
  const safe_to_continue =
    do_not_send.length === 0 &&
    unsupported.length === 0 &&
    needs_human_approval.length === 0 &&
    mismatches.length === 0;

  // A NOT-safe receipt must never leave the reader with "(none)" under Next Actions: a flag with no
  // accompanying instruction is a dead end. When the caller supplied no next actions, derive concrete,
  // deterministic ones from the flagged steps. Honesty ceiling intact: every derived action is an
  // instruction to verify / reconcile / get approval — never a claim that the work succeeded.
  const next_actions =
    (run.next_actions ?? []).length > 0 || safe_to_continue
      ? (run.next_actions ?? [])
      : deriveNextActions(steps, L);

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
    next_actions,
    needs_human_approval,
    do_not_re_litigate: run.do_not_re_litigate ?? [],
    safe_to_continue,
    proof_refs: run.proof_refs ?? null,
    // Claim-to-action spine, run level. Emitted ONLY on a contract-enabled run, so a plain run's handoff
    // is byte-identical to before. `agents` attributes steps to agents from CAPTURED EVIDENCE ONLY — an
    // agent whose tool path was not routed through Lyhna simply never appears (see contract.mjs).
    ...(contractEnabled
      ? {
          ...(present(run.parent_loop_id) ? { parent_loop_id: String(run.parent_loop_id) } : {}),
          ...(present(run.receipt_id) ? { receipt_id: String(run.receipt_id) } : {}),
          agents: summarizeAgents(steps)
        }
      : {})
  };
}

// Derive concrete next actions from the flagged steps when the caller supplied none. Deterministic
// (one action per flagged step, in step order) and strictly an instruction to verify/reconcile/seek
// approval — never an assertion that anything happened. Called only for NOT-safe receipts.
function deriveNextActions(steps, L) {
  const where = (s) => {
    if (!s.claimed) return `step ${s.index + 1}`;
    const action = s.claimed.action ? `"${s.claimed.action}"` : "the step";
    return `${action}${s.claimed.system ? ` in ${s.claimed.system}` : ""}`;
  };
  const actions = [];
  for (const s of steps) {
    const n = s.index + 1;
    if (s.labels.includes(L.UNSUPPORTED) && !s.witnessed) {
      actions.push(
        `Confirm step ${n} actually happened — the agent claimed ${where(s)} but the witness saw no tool call — before telling anyone it is done.`
      );
    } else if (s.labels.includes(L.CLAIMED_ACTUAL_MISMATCH)) {
      // Check mismatch BEFORE the generic unsupported branch: a mismatch step (e.g. claimed
      // gmail.send but the witness saw gmail.create_draft return) is ALSO labeled UNSUPPORTED, yet
      // the witnessed call did succeed — so "did not succeed" would misstate the evidence. The honest
      // instruction is to reconcile the claim against what the witness actually saw.
      actions.push(`Reconcile step ${n}: the agent's account of ${where(s)} does not match what the witness saw.`);
    } else if (s.labels.includes(L.UNSUPPORTED)) {
      actions.push(`Re-run or verify step ${n}: the witnessed ${where(s)} did not succeed.`);
    } else if (s.labels.includes(L.NEEDS_HUMAN_APPROVAL)) {
      actions.push(`Get human approval for step ${n} before proceeding.`);
    }
  }
  // Defensive: a NOT-safe receipt always yields at least one action above, but never return empty.
  if (actions.length === 0) actions.push("Resolve the flagged steps above before continuing or sending.");
  return actions;
}

const bullet = (items) => (items.length ? items.map((x) => `- ${x}`).join("\n") : "_(none)_");

// Count-aware noun so the summary line reads "0 mismatches" / "1 mismatch" / "3 steps" — never the
// ungrammatical "0 mismatch". Only the true count-nouns (step, mismatch) need this; "supported" etc.
// read fine as adjective counts ("2 supported", "0 do-not-send").
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The witness's proof refs (e.g. a vouched-for file URL + result hash + capture time) are the
// evidence a SUPPORTED step rests on. Render them as labelled bullets when present so neither the
// human handoff nor the next-agent prompt drops the only pointer to the verifiable artifact. Returns
// [] when there are none, so handoffs without proof_refs render byte-identically to before.
function proofRefLines(proofRefs) {
  if (!proofRefs || typeof proofRefs !== "object" || Array.isArray(proofRefs)) return [];
  const entries = Object.entries(proofRefs).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return entries.map(([k, v]) => `${k}: ${v}`);
}

// Conditional section: emitted ONLY when proof refs exist, so a handoff with `proof_refs: null`
// renders exactly as it did before this section was added (no golden-file drift).
function proofRefsSection(heading, proofRefs) {
  const lines = proofRefLines(proofRefs);
  return lines.length ? [heading, bullet(lines), ``] : [];
}

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
    `**${verdict}**  ·  ${count(h.summary.total_steps, "step", "steps")} · ${h.summary.supported} supported · ` +
      `${count(h.summary.mismatches, "mismatch", "mismatches")} · ${h.summary.unsupported} unsupported · ` +
      `${h.summary.do_not_send} do-not-send`,
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
    `## Do Not Send`,
    bullet(by(L.DO_NOT_SEND).map((s) => `Step ${s.index + 1}: ${s.human_note}`)),
    ``,
    ...proofRefsSection(`## Proof / References`, h.proof_refs),
    `## Settled Decisions`,
    `_Operator-declared continuation context — carried into the handoff, not witnessed or verified by Lyhna._`,
    bullet(h.settled),
    ``,
    `## Do Not Re-Litigate`,
    `_Operator-declared — not witnessed or verified by Lyhna._`,
    bullet(h.do_not_re_litigate),
    ``,
    `## Open Questions`,
    bullet(h.open_questions),
    ``,
    // Only steps the witness actually routed for human approval (NEEDS_HUMAN_APPROVAL) belong here.
    // DO_NOT_SEND steps are NOT formally approval-gated — they have their own "Do Not Send" section
    // above — so listing them here would assert an approval gate the witness never observed.
    `## Human Approval Needed`,
    bullet(h.needs_human_approval.map((i) => `Step ${i + 1}: routed for human approval`)),
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
    `The operator declared these settled (Lyhna did NOT witness or verify them) — do not re-litigate unless new evidence appears:`,
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
    `These steps REQUIRE HUMAN APPROVAL before anyone proceeds — do not act on them yourself:`,
    bullet(
      h.steps
        .filter((s) => s.labels.includes("NEEDS_HUMAN_APPROVAL"))
        .map((s) => `Step ${s.index + 1}: awaiting human approval`)
    ),
    ``,
    `Open questions:`,
    bullet(h.open_questions),
    ``,
    `Start from these next actions:`,
    bullet(h.next_actions),
    ``,
    ...proofRefsSection(
      `Proof / references the witness recorded — carry these forward so the vouched-for work stays verifiable:`,
      h.proof_refs
    ),
    h.safe_to_continue
      ? `Safe to continue.`
      : `NOT safe to send/continue until the unverified steps and any required approvals above are resolved.`,
    ``
  ].join("\n");
}
