// Lyhna Witness — the Claim-to-Action Receipt Contract (the capsule spine).
//
// The receipt already says, per step, what the agent claimed vs. what the witness saw and a
// deterministic trust label. The CONTRACT adds the connective tissue a multi-agent capsule needs to
// attribute each claim honestly: which agent/subagent made it, which claim and witnessed call it links
// to, how that link was established, a coarse action-family + result-state comparison, a single rolled-up
// status, and a one-line reader explanation bounded to witnessed evidence.
//
// HONESTY CEILING. The contract derives EVERYTHING from data the witness already has — the labels, the
// human_note, and identifiers the proxy supplied. It invents nothing: no artifact is fabricated when
// artifact_id is absent, observed_result_state is never "success" (the witness knows only that a call
// returned, not that it semantically succeeded), and an unsupported claim never rolls up to "supported".
//
// BACKWARD-COMPATIBLE. The contract is OPT-IN: it is attached only when a run carries spine signals
// (see hasContractSignal). A plain run produces byte-identical output to before, so every existing
// example and golden file is untouched.
//
// Deterministic by contract: fixed rules only — no clock, no randomness, no model calls.

const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");

// The single rolled-up status, one of the agent-facing values. Derived from the deterministic labels by
// fixed priority. NEEDS_HUMAN_APPROVAL leads because a human gate blocks everything downstream; then the
// safety-critical "no evidence" case; then route-only mismatch (work may be fine, reconcile); then a bare
// evidence gap; then supported. The fallback is the FAIL-SAFE "needs_evidence", never "supported".
export const CONTRACT_STATUS = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  MISMATCH: "mismatch",
  NEEDS_EVIDENCE: "needs_evidence",
  NEEDS_APPROVAL: "needs_approval"
});

export function statusFromLabels(labels = []) {
  const has = (l) => labels.includes(l);
  if (has("NEEDS_HUMAN_APPROVAL")) return CONTRACT_STATUS.NEEDS_APPROVAL;
  if (has("UNSUPPORTED")) return CONTRACT_STATUS.UNSUPPORTED;
  if (has("CLAIMED_ACTUAL_MISMATCH")) return CONTRACT_STATUS.MISMATCH;
  if (has("NEEDS_EVIDENCE")) return CONTRACT_STATUS.NEEDS_EVIDENCE;
  if (has("SUPPORTED")) return CONTRACT_STATUS.SUPPORTED;
  return CONTRACT_STATUS.NEEDS_EVIDENCE; // fail-safe: an unlabeled step is never "supported"
}

// Coarse, deterministic action family for an action verb. Ordered so a more specific intent wins:
// a "send"/"email" reads as send even though it also mutates; a draft/create reads as write. Returns
// null when there is no action to classify (never invents one).
export function actionFamily(action) {
  const a = norm(action);
  if (!a) return null;
  if (/(^|_)(send|email|notify|message|reply|publish|dispatch|post)(_|$)/.test(a)) return "send";
  if (/(^|_)(read|get|fetch|list|search|query|find|load|view)(_|$)/.test(a)) return "read";
  if (/(^|_)(write|create|update|edit|patch|insert|save|upload|modify|append|delete|remove|draft)(_|$)/.test(a))
    return "write";
  if (/(^|_)(run|exec|execute|test|build|deploy|invoke|call|trigger)(_|$)/.test(a)) return "execute";
  return "other";
}

// The agent's CLAIMED result state — clearly the agent's account, never a fact. "claimed_completed" when
// it narrated a result, "claimed_attempted" when it claimed a step with no stated result, null with no claim.
export function claimedResultState(claimed) {
  if (!claimed) return null;
  return claimed.result !== undefined && claimed.result !== null && String(claimed.result).trim() !== ""
    ? "claimed_completed"
    : "claimed_attempted";
}

// The OBSERVED result state — only what the witness recorded. Deliberately never "success": a returned
// call is evidence the call ran and came back, NOT that it did what the agent said. Blocked verdicts
// (refused/escalated) never ran.
export function observedResultState(witnessed) {
  if (!witnessed) return "no_observed_call";
  const r = norm(witnessed.result);
  if (r === "refused") return "blocked_refused";
  if (r === "escalated") return "blocked_escalated";
  if (witnessed.returned === false || r === "error" || r === "failed" || r === "failure" || r === "timeout")
    return "error";
  if (witnessed.returned === true) return "returned";
  return "unknown";
}

// A human label for the agent that owns a step, for reader-facing attribution. Prefers a role
// ("Research Agent") over a raw id; falls back to the id; null when neither is present.
function agentLabel({ agent_id, subagent_role }) {
  if (subagent_role) {
    const role = String(subagent_role).trim();
    return /agent$/i.test(role) ? role : `${role} agent`;
  }
  if (agent_id) return String(agent_id).trim();
  return null;
}

// One plain-language sentence, ATTRIBUTED to the agent but BOUNDED to witnessed evidence: it reuses the
// step's human_note (already ceiling-safe) and only prepends who claimed it. It never asserts more than
// the note does.
function readerExplanation({ agent_id, subagent_role }, humanNote, status) {
  const label = agentLabel({ agent_id, subagent_role });
  const note = humanNote && humanNote.trim() ? humanNote.trim() : statusFallbackNote(status);
  if (!label) return note;
  const Label = label.charAt(0).toUpperCase() + label.slice(1);
  // Fold the agent in as the sentence subject when the witnessed note opens with the generic
  // "The agent" (avoids the doubled "Research agent: The agent claimed…"). Otherwise prefix the
  // attribution. The witnessed note is reused verbatim, so the explanation stays ceiling-bounded.
  if (/^the agent\b/i.test(note)) return note.replace(/^the agent\b/i, Label);
  return `${Label}: ${note}`;
}

function statusFallbackNote(status) {
  switch (status) {
    case CONTRACT_STATUS.SUPPORTED:
      return "The agent's account matches what the witness observed.";
    case CONTRACT_STATUS.NEEDS_APPROVAL:
      return "Held for human approval before it could run; no evidence the work happened yet.";
    default:
      return "No witnessed tool evidence supports this step.";
  }
}

const present = (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");

/**
 * Does this run carry any claim-to-action spine signal? If not, the contract is not attached and the
 * output stays byte-identical to a pre-contract run. Checked at run level so a spine-enabled capsule
 * carries the contract on EVERY step (coherent vocabulary), while a legacy run carries none.
 */
export function hasContractSignal(run) {
  if (!run || typeof run !== "object") return false;
  if (present(run.parent_loop_id) || present(run.receipt_id)) return true;
  return (run.steps ?? []).some(
    (s) =>
      s &&
      (present(s.agent_id) ||
        present(s.subagent_role) ||
        present(s.artifact_id) ||
        present(s.link_basis) ||
        present(s.claim?.claim_id) ||
        present(s.claim?.claim_turn_id) ||
        present(s.event?.turn_ref) ||
        present(s.event?.call_id) ||
        present(s.event?.call?.call_id))
  );
}

/**
 * Resolve how a step's claim was linked to its witnessed call, and whether an EXPLICIT link CONFLICTS.
 * Explicit linkage (claim_turn_id ↔ turn_ref) governs over ordinal pairing: when both are present and
 * EQUAL the link is "explicit"; when both are present and DIFFER the witnessed call does not belong to
 * this claim — a conflict — and we must NOT trust the ordinal pairing (fail safe: drop the witnessed
 * call for this step so the claim reads unsupported rather than being vouched for by the wrong call).
 *
 * @returns {{ basis:string, conflict:boolean }}
 *   basis: "explicit" | "ordinal" | "unwitnessed" | "observation" | "conflict" | "empty"
 */
export function resolveLink(step) {
  const claim = step?.claim ?? null;
  const event = step?.event ?? null;
  const explicitOverride = norm(step?.link_basis);
  const claimTurn = present(claim?.claim_turn_id) ? String(claim.claim_turn_id) : null;
  const turnRef = present(event?.turn_ref) ? String(event.turn_ref) : null;

  if (!claim && !event) return { basis: "empty", conflict: false };
  if (claim && !event) return { basis: "unwitnessed", conflict: false };
  if (!claim && event) return { basis: "observation", conflict: false };

  // Both present. An explicit id pair governs.
  if (claimTurn && turnRef) {
    return claimTurn === turnRef ? { basis: "explicit", conflict: false } : { basis: "conflict", conflict: true };
  }
  if (explicitOverride === "explicit") return { basis: "explicit", conflict: false };
  if (explicitOverride === "conflict") return { basis: "conflict", conflict: true };
  return { basis: "ordinal", conflict: false };
}

/**
 * Build the per-step contract block from the LABELED step (after computeStepLabels) plus the spine
 * identifiers carried on the original input step. Only non-null identifiers are emitted (artifact_id and
 * the rest are omitted when absent — never fabricated). Always present: the derived comparison fields,
 * the rolled-up status, the link_basis, and the reader_explanation.
 *
 * @param {object} labeledStep  a step from computeStepLabels: { index, claimed, witnessed, labels, human_note }
 * @param {object} spine        identifiers from the input: { agent_id, parent_loop_id, subagent_role,
 *                              claim_id, claim_turn_id, turn_ref, call_id, receipt_id, artifact_id, link_basis }
 * @returns {object} the contract block
 */
export function buildStepContract(labeledStep, spine = {}) {
  const claimed = labeledStep.claimed ?? null;
  const witnessed = labeledStep.witnessed ?? null;
  const status = statusFromLabels(labeledStep.labels ?? []);

  const contract = {};
  // --- identity / linkage: emit only what is real ---
  if (present(spine.agent_id)) contract.agent_id = String(spine.agent_id);
  if (present(spine.parent_loop_id)) contract.parent_loop_id = String(spine.parent_loop_id);
  if (present(spine.subagent_role)) contract.subagent_role = String(spine.subagent_role);
  if (present(spine.claim_id)) contract.claim_id = String(spine.claim_id);
  if (present(spine.claim_turn_id)) contract.claim_turn_id = String(spine.claim_turn_id);
  if (present(spine.turn_ref)) contract.turn_ref = String(spine.turn_ref);
  if (present(spine.call_id)) contract.call_id = String(spine.call_id);
  if (present(spine.receipt_id)) contract.receipt_id = String(spine.receipt_id);
  if (present(spine.artifact_id)) contract.artifact_id = String(spine.artifact_id); // optional — never fabricated

  // --- coarse comparison (always present, derived; null when there is nothing to classify) ---
  contract.claimed_action_family = actionFamily(claimed?.action);
  contract.observed_action_family = actionFamily(witnessed?.action);
  contract.claimed_result_state = claimedResultState(claimed);
  contract.observed_result_state = observedResultState(witnessed);

  // --- rolled-up status, link basis, and reader-facing explanation (always present) ---
  contract.status = status;
  contract.link_basis = spine.link_basis ?? "ordinal";
  contract.reader_explanation = readerExplanation(spine, labeledStep.human_note, status);

  return contract;
}

/**
 * Summarize per-agent attribution for the run, from CAPTURED EVIDENCE ONLY. Lists each distinct agent
 * (by agent_id, with its role) that appears in the contracted steps, the steps attributed to it, and
 * whether any of those steps lacks witnessed support. It explicitly does NOT claim to have captured every
 * agent: an agent whose tool path was not routed through Lyhna simply never appears here.
 */
export function summarizeAgents(contractedSteps) {
  const byAgent = new Map();
  for (const s of contractedSteps) {
    const c = s.contract;
    if (!c || !present(c.agent_id)) continue;
    const key = c.agent_id;
    if (!byAgent.has(key)) {
      byAgent.set(key, {
        agent_id: c.agent_id,
        ...(c.subagent_role ? { subagent_role: c.subagent_role } : {}),
        steps: [],
        statuses: [],
        has_unsupported: false
      });
    }
    const entry = byAgent.get(key);
    entry.steps.push(s.index + 1);
    entry.statuses.push(c.status);
    if (c.status === CONTRACT_STATUS.UNSUPPORTED || (s.labels ?? []).includes("UNSUPPORTED")) {
      entry.has_unsupported = true;
    }
  }
  // Finalize each agent's roll-up. `all_supported` is the ONLY honest basis for an "all good" message:
  // a branch that is a route/action mismatch or is awaiting approval is NOT supported, even though it is
  // not flagged UNSUPPORTED. `nonsupported_statuses` names exactly what is wrong, so the attribution
  // text in every export can be specific instead of collapsing to a misleading "all supported".
  for (const entry of byAgent.values()) {
    const nonsupported = [...new Set(entry.statuses.filter((s) => s !== CONTRACT_STATUS.SUPPORTED))].sort();
    entry.all_supported = entry.statuses.length > 0 && nonsupported.length === 0;
    entry.nonsupported_statuses = nonsupported;
  }
  return [...byAgent.values()];
}

// A short, honest one-liner describing an agent's worst-case branch status, shared by every export's
// attribution text. Never says "supported" unless EVERY attributed step is supported.
export function agentBranchFlag(a) {
  if (a.all_supported) return "all attributed steps supported";
  return `⚠ not all supported — branch status: ${(a.nonsupported_statuses ?? []).join(", ") || "unknown"}`;
}
