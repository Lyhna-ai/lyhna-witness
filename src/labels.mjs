// Lyhna Witness — deterministic trust labels (claimed vs. actual).
//
// The labels are computed from the event sequence by FIXED RULES, never by a model's opinion.
// That determinism is the trust: Lyhna witnesses what crossed the tool boundary and compares it
// to what the agent claimed. It does NOT judge whether the work was good, and it does NOT know
// reality outside the observed path (see THESIS.md §6, the V1 promise).

/** The full label vocabulary (THESIS.md §7). */
export const TRUST_LABELS = Object.freeze({
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
  NEEDS_EVIDENCE: "NEEDS_EVIDENCE",
  NEEDS_HUMAN_APPROVAL: "NEEDS_HUMAN_APPROVAL",
  CLAIMED_ACTUAL_MISMATCH: "CLAIMED_ACTUAL_MISMATCH",
  SETTLED: "SETTLED",
  REOPENED: "REOPENED",
  SAFE_TO_CONTINUE: "SAFE_TO_CONTINUE",
  DO_NOT_SEND: "DO_NOT_SEND",
  DO_NOT_RE_LITIGATE: "DO_NOT_RE_LITIGATE"
});

const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");

// Generic actor/app-invocation verbs. When an app-only wrapper (resolved app, no sub-action — e.g. Apify
// `call-actor`) is observed, the boundary corroborates only that the actor/app was INVOKED, so only a
// claim naming that generic invocation rides as supported; any specific claimed action stays fail-closed.
const APP_INVOCATION_ACTIONS = new Set(["call_actor", "call-actor", "run_actor", "invoke_actor", "call_app", "invoke"]);

/** A result string that denotes failure. Witnessed `returned === false` is also failure. */
function isErrorResult(result) {
  const r = norm(result);
  return r === "error" || r === "failed" || r === "failure" || r === "timeout" || r === "rejected";
}

/**
 * A result string that denotes the call was BLOCKED BEFORE EXECUTION (refused at the gate, or held for
 * human approval). Unlike an `error`, the tool never RAN — so the note must not say it "ran". This is a
 * precision point of the honesty ceiling: the witness only saw the call blocked, not executed.
 */
function isBlockedResult(result) {
  const r = norm(result);
  return r === "refused" || r === "escalated";
}

// The plain-language note for a non-successful witnessed call. A refused/escalated call was blocked
// before it ran (the tool did not execute); only a returned-but-errored call actually ran.
function failureNote(result) {
  const r = norm(result);
  if (r === "refused") {
    return `The witness saw this call refused — it was blocked before it ran, so the tool did not execute and there is no evidence the work happened.`;
  }
  if (r === "escalated") {
    return `The witness saw this call escalated for human approval — it was held before it ran, so the tool did not execute and the work has not happened yet.`;
  }
  return `The tool call ran but did not succeed (result: ${result ?? "error"}).`;
}

/**
 * Path mismatch = the agent's claimed route is not the route the witness observed. Two cases:
 *  (a) the call was routed through an undisclosed wrapper family (e.g. the agent claimed a direct
 *      app but the witness saw it go through Zapier) — the Hermes catch; OR
 *  (b) the claimed system simply differs from the witnessed system.
 * Case (a) fires even when the underlying app matches (claimed google_docs, witnessed
 * zapier→google_docs): the route the human was told is still wrong.
 */
function isPathMismatch(claimed, witnessed) {
  if (!claimed || !witnessed) return false;
  const wrapper = norm(witnessed.wrapper_family);
  if (wrapper) {
    const claimedRoute = norm(claimed.via) || norm(claimed.system);
    if (claimedRoute !== wrapper) return true; // routed through a wrapper the agent did not disclose
    // Wrapper disclosed: the claim is honest about the route, so compare the underlying app the
    // agent named (claimed.system) to the app the witness saw under the wrapper (witnessed.app).
    if (norm(claimed.system) && norm(witnessed.app) && norm(claimed.system) !== norm(witnessed.app)) {
      return true;
    }
    return false;
  }
  return norm(claimed.system) !== norm(witnessed.system);
}

function mismatchNote(claimed, witnessed) {
  const wrapper = norm(witnessed.wrapper_family);
  if (wrapper && norm(claimed.system) !== wrapper) {
    const under = [witnessed.app, witnessed.action].filter(Boolean).join(".");
    return (
      `The agent said it used ${claimed.system || "a direct integration"} directly, but the witness ` +
      `saw it routed through ${witnessed.wrapper_family}` +
      (under ? ` (${witnessed.wrapper_family} → ${under})` : "") +
      `. Same end app or not, the path you were told is not the path it took.`
    );
  }
  return (
    `The agent said it used ${claimed.system || "(unspecified)"}, but the witness saw ` +
    `${witnessed.system || "(unspecified)"}. The systems do not match.`
  );
}

/**
 * Action/result mismatch: the route may match, but the agent named a different ACTION than the
 * witness saw, or claimed a different RESULT than the witness recorded. Compared only when BOTH
 * sides state the field, so a missing field never fabricates a mismatch. This is what stops a
 * claimed `gmail.send`/`sent` step that the witness only saw as `gmail.create_draft`/`created`
 * from being labeled SUPPORTED — exactly the claimed-vs-actual guarantee the witness exists to make.
 */
function actionResultMismatch(claimed, witnessed) {
  if (!claimed || !witnessed) return { mismatch: false, note: "" };
  const parts = [];
  const ca = norm(claimed.action);
  const wa = norm(witnessed.action);
  if (ca && wa && ca !== wa) {
    parts.push(`a "${claimed.action}" action, but the witness saw "${witnessed.action}"`);
  }
  const cr = norm(claimed.result);
  const wr = norm(witnessed.result);
  if (cr && wr && cr !== wr) {
    parts.push(`the result "${claimed.result}", but the witness recorded "${witnessed.result}"`);
  }
  if (!parts.length) return { mismatch: false, note: "" };
  return {
    mismatch: true,
    note: `The agent claimed ${parts.join(" and ")}. What it did or got back does not match what the witness observed.`
  };
}

// A grammatical noun phrase for the agent's claim, e.g. `a "send" action in gmail`. Quoting the action
// keeps the surrounding sentence readable ("The agent claimed a \"send\" action in gmail") instead of
// splicing a bare verb into it ("claimed it send in gmail").
function claimedPhrase(claimed) {
  if (!claimed) return "it did something";
  const sys = claimed.system ? ` in ${claimed.system}` : "";
  return claimed.action ? `a "${claimed.action}" action${sys}` : `it completed a step${sys}`;
}

const dedup = (arr) => [...new Set(arr)];

/**
 * Compute the deterministic labels + a plain-language note for one step.
 * @param {{index?:number, claimed?:object|null, witnessed?:object|null, needs_human_approval?:boolean, user_facing?:boolean}} step
 * @returns {{index:number, claimed:object|null, witnessed:object|null, labels:string[], human_note:string}}
 */
export function computeStepLabels(step) {
  const L = TRUST_LABELS;
  const claimed = step.claimed ?? null;
  const witnessed = step.witnessed ?? null;
  const userFacing = Boolean(step.user_facing ?? claimed?.user_facing);
  const labels = [];
  const notes = [];

  // 1) Claimed but never witnessed — the dangerous case. No evidence it happened.
  if (claimed && !witnessed) {
    labels.push(L.UNSUPPORTED, L.NEEDS_EVIDENCE);
    if (userFacing) labels.push(L.DO_NOT_SEND);
    notes.push(
      `The agent claimed ${claimedPhrase(claimed)}, but the witness saw no tool call for this step — ` +
        `there is no evidence it actually happened.`
    );
    return finalize(step, labels, notes, claimed, witnessed);
  }

  // A witnessed step with no claim is recorded as an observation. It is SUPPORTED only if the call
  // actually succeeded — a no-claim call that did NOT return (a failure, or a REFUSED/ESCALATED
  // verdict the witness records as returned:false) must not read as supported work, or an unclaimed
  // failed observation would let the run be marked safe_to_continue (fail-open).
  if (!claimed && witnessed) {
    const observedFailure = witnessed.returned === false || isErrorResult(witnessed.result);
    if (observedFailure) {
      labels.push(L.UNSUPPORTED);
      notes.push(
        `Witnessed tool call with no agent claim that did not succeed (${witnessed.result ?? "no result returned"}); ` +
          `recorded as an observed failure, not supported work.`
      );
    } else {
      labels.push(L.SUPPORTED);
      notes.push(`Witnessed tool call with no agent claim attached; recorded as observed.`);
    }
    return finalize(step, labels, notes, claimed, witnessed);
  }

  if (!claimed && !witnessed) {
    labels.push(L.NEEDS_EVIDENCE);
    notes.push(`Empty step: neither a claim nor a witnessed call.`);
    return finalize(step, labels, notes, claimed, witnessed);
  }

  // 2) Witnessed failure.
  const failed = witnessed.returned === false || isErrorResult(witnessed.result) || isBlockedResult(witnessed.result);
  if (failed) {
    labels.push(L.UNSUPPORTED);
    if (userFacing) labels.push(L.DO_NOT_SEND);
    notes.push(failureNote(witnessed.result));
  }

  // 2b) Wrapper route seen, but the operation under it was UNREADABLE. The witness saw a call go
  //     through a wrapper family (e.g. Zapier) and return, but could not determine which app/action
  //     it performed — so it cannot vouch that the claimed app/action actually happened. A returned
  //     call is NOT evidence for the specific claim; treat it as needing evidence (and, with a claim,
  //     unsupported) rather than letting a bare wrapper return read as "safe".
  const operationUnverified = Boolean(norm(witnessed.wrapper_family)) && !norm(witnessed.app);
  if (operationUnverified) {
    labels.push(L.NEEDS_EVIDENCE, L.UNSUPPORTED);
    if (userFacing) labels.push(L.DO_NOT_SEND);
    notes.push(
      `The witness saw a ${witnessed.wrapper_family} call return, but could not read which app or ` +
        `action it performed — there is no evidence the claimed step actually happened.`
    );
  }

  // 3) Claimed-vs-actual mismatch. Two independent axes, either of which fires the label:
  //    (a) the ROUTE differs (the Hermes catch — "said Google, witness saw Zapier"); and/or
  //    (b) the ACTION or RESULT differs (same system, but "said it sent" / witness saw a draft).
  const pathMismatch = isPathMismatch(claimed, witnessed);
  const actionResult = actionResultMismatch(claimed, witnessed);
  const mismatch = pathMismatch || actionResult.mismatch;
  if (mismatch) {
    labels.push(L.CLAIMED_ACTUAL_MISMATCH);
    if (pathMismatch) notes.push(mismatchNote(claimed, witnessed));
    if (actionResult.mismatch) {
      // A different ACTION or RESULT means the claimed work did not happen as stated — unlike a
      // route-only mismatch, where the same action/result was achieved via another path and the
      // work may well be fine. So an action/result mismatch is also UNSUPPORTED (and DO_NOT_SEND
      // when user-facing), which keeps the run from being marked safe to continue.
      labels.push(L.UNSUPPORTED);
      if (userFacing) labels.push(L.DO_NOT_SEND);
      notes.push(actionResult.note);
    }
  }

  // 3b) The agent named a specific ACTION the witness could NOT corroborate AT ALL. The call returned, but
  //     the witness resolved NEITHER a sub-action NOR an app from it (a flat / opaque tool name, e.g.
  //     `gmail`), so it cannot confirm the call performed the claimed action. A bare returned call is
  //     evidence the call RAN — not that the agent's stated action happened — so it must not read as
  //     SUPPORTED. This is the non-wrapper twin of `operationUnverified` (2b): same fail-closed stance,
  //     action axis. A resolved APP without a sub-action does NOT trip this — a wrapper like Apify
  //     `call-actor` legibly observes the actor/app at the boundary (`witnessed.app` set, `witnessed.action`
  //     null), which corroborates the operation even though there is no finer action to compare. (The
  //     RESULT axis is deliberately NOT used here — a successful call carries no witnessed result by design,
  //     so comparing a claimed result against an always-absent witnessed result would flag every legitimate
  //     supported step.) Only fires when nothing above already flagged the step.
  // An app-only wrapper (resolved app, no sub-action — e.g. Apify `call-actor`) corroborates the generic
  // actor/app INVOCATION at the boundary, but NOT any specific sub-action. So a claim that names that
  // generic invocation is supported, while a claim of a SPECIFIC action the witness never saw (e.g.
  // "send" on an opaque actor call) must still fail closed.
  const appOnlyWrapper = Boolean(norm(witnessed.app)) && !norm(witnessed.action);
  const claimIsGenericInvocation = appOnlyWrapper && APP_INVOCATION_ACTIONS.has(norm(claimed.action));
  const actionUnverified =
    !failed &&
    !mismatch &&
    !operationUnverified &&
    Boolean(norm(claimed.action)) &&
    !norm(witnessed.action) &&
    !claimIsGenericInvocation;
  if (actionUnverified) {
    labels.push(L.NEEDS_EVIDENCE, L.UNSUPPORTED);
    if (userFacing) labels.push(L.DO_NOT_SEND);
    notes.push(
      `The agent claimed ${claimedPhrase(claimed)}, but the witness saw the call return without being ` +
        `able to confirm it performed that action — there is no evidence the claimed step actually happened.`
    );
  }

  // 4) Agreement.
  if (!failed && !mismatch && !operationUnverified && !actionUnverified) {
    labels.push(L.SUPPORTED);
    notes.push(`The agent's account matches what the witness observed.`);
  }

  return finalize(step, labels, notes, claimed, witnessed);
}

function finalize(step, labels, notes, claimed, witnessed) {
  // Human approval is never decided by a model — it is routed to a person. Applied HERE, in the
  // one function every return path flows through, so the label survives all of computeStepLabels'
  // early returns (an unwitnessed-but-approval-gated step must not silently drop it and read safe).
  if (step.needs_human_approval) labels.push(TRUST_LABELS.NEEDS_HUMAN_APPROVAL);
  return {
    index: typeof step.index === "number" ? step.index : 0,
    claimed: claimed ?? null,
    witnessed: witnessed ?? null,
    labels: dedup(labels),
    human_note: notes.join(" ")
  };
}
