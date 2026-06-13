// Lyhna Witness — witnessed-event adapter (slice 5: wire the generator to the proxy's REAL event
// vocabulary instead of hand-mocked {system, app, action} objects).
//
// The "actual" half of claimed-vs-actual already exists, proven and frozen, in lyhna-mcp-proxy:
//   - src/extractors/wrapper-registry.ts  — cracks a universal wrapper call
//       (`execute_zapier_<app>_action`, Apify `call-actor`) into its TRUE operation
//       (`zapier.<app>.<action>`). THIS is the mechanism that catches "agent called Zapier when it
//       claimed Google."
//   - src/judgment-ledger.ts              — JudgmentVerdict {kind} + JudgmentRuntimeReport
//       {returned, result_hash, error_hash}: what the runtime actually returned, HASHED not judged.
//
// Per BUILD-PLAN.md §1/§4.5 the witness READS those shapes and MIRRORS them here; it never edits the
// proxy. This file is a faithful JS mirror of the wrapper-family resolution (the proxy remains the
// canonical owner, lyhna-mcp-proxy @ c20fca9), plus the mapping from a witnessed tool call +
// verdict + runtime report into the `witnessed` step the deterministic labeler already understands.

const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");

// --- Wrapper-family descriptors: a faithful mirror of WRAPPER_FAMILY_DESCRIPTORS in the frozen
// proxy (src/extractors/wrapper-registry.ts). Mirrored, not imported, because the proxy is TS and
// the witness is zero-dependency ESM; if a family is ever added there, mirror it here too. ---
const ZAPIER_WRAPPER_TOOL_NAME = /^(?:mcp_zapier_)?execute_zapier_[a-z0-9_]+_action$/;

const WRAPPER_FAMILY_DESCRIPTORS = [
  {
    family: "zapier",
    matchesToolName: (toolName) => ZAPIER_WRAPPER_TOOL_NAME.test(toolName),
    argumentReader: "stringified-json",
    operationFieldPaths: [["app"], ["action"]],
    // app + action → { app, action }
    parse: ([app, action]) => ({ app: normalizeActionPart(app), action: normalizeActionPart(action) })
  },
  {
    family: "apify",
    matchesToolName: (toolName) => toolName === "call-actor",
    argumentReader: "plain-object",
    operationFieldPaths: [["actor"]],
    // a single actor IS the app; there is no sub-action
    parse: ([actor]) => ({ app: normalizeActionPart(actor), action: null })
  }
];

function normalizeActionPart(value) {
  return value.trim().toLowerCase().replace(/[\/\s]+/g, "_");
}

/**
 * Split a non-wrapper tool name into { system, action } by common MCP conventions:
 * `mcp__Server__tool`, `server__tool`, or `server.tool`. A flat name with no separator IS the
 * system (no derivable sub-action). Conservative: never invents a split that is not in the name.
 */
function splitToolName(toolName) {
  const stripped = toolName.replace(/^mcp[_]{1,2}/i, "");
  const parts = stripped.includes("__") ? stripped.split("__") : stripped.split(".");
  if (parts.length >= 2 && parts[0]) {
    return { system: norm(parts[0]), action: norm(parts.slice(1).join("_")) || null };
  }
  return { system: toolName, action: null };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readDeclaredArguments(rawArguments, reader) {
  if (reader === "plain-object") {
    return isRecord(rawArguments) ? rawArguments : undefined;
  }
  if (typeof rawArguments !== "string") return undefined;
  try {
    const parsed = JSON.parse(rawArguments);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readStringField(declaredArguments, fieldPath) {
  let value = declaredArguments;
  for (const segment of fieldPath) {
    if (!isRecord(value)) return undefined;
    value = value[segment];
  }
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return value;
}

function readOperationValues(declaredArguments, fieldPaths) {
  const values = fieldPaths.map((fieldPath) => readStringField(declaredArguments, fieldPath));
  if (values.some((value) => value === undefined)) return undefined;
  return values;
}

/**
 * Resolve a witnessed tool call into its real route. For a wrapper-family call this is the catch:
 * the agent's tool was `execute_zapier_google_docs_action`, the witness sees it is really
 * `zapier → google_docs.create_document`. For a non-wrapper call there is no hidden route, so the
 * tool itself is the system.
 * @param {{toolName:string, arguments?:unknown}} call
 * @returns {{ system:string, app:(string|null), action:(string|null), wrapper_family:(string|null) }}
 */
export function resolveWitnessedAction(call) {
  const toolName = call?.toolName ?? "";
  const descriptor = WRAPPER_FAMILY_DESCRIPTORS.find((d) => d.matchesToolName(toolName));
  if (!descriptor) {
    // No hidden route. Best-effort split into system + action by common MCP tool-name conventions
    // so the claim ("gmail" / "send") can be compared to the witnessed call ("gmail.send").
    const { system, action } = splitToolName(toolName);
    return { system, app: null, action, wrapper_family: null };
  }
  const declared = readDeclaredArguments(call.arguments, descriptor.argumentReader);
  const operationValues = declared && readOperationValues(declared, descriptor.operationFieldPaths);
  if (!operationValues) {
    // Wrapper tool, but its arguments did not disclose the operation. The route is still the
    // wrapper family — that alone is enough to flag a claim of a direct integration.
    return { system: descriptor.family, app: null, action: null, wrapper_family: descriptor.family };
  }
  const { app, action } = descriptor.parse(operationValues);
  return { system: descriptor.family, app, action, wrapper_family: descriptor.family };
}

/**
 * Map a witnessed event — a tool call as the proxy observed it, plus the judgment-ledger verdict and
 * runtime report — into the `witnessed` half of a step (and any step-level flags). Mirrors the proxy
 * types McpToolCall / JudgmentVerdict / JudgmentRuntimeReport.
 *
 * @param {object} event
 * @param {{toolName:string, arguments?:unknown}} event.call            the witnessed tool call
 * @param {{kind?:string}} [event.verdict]                              APPROVED | ESCALATED | REFUSED
 * @param {{returned?:boolean, result_hash?:string, error_hash?:string}} [event.runtime_report]
 * @returns {{ witnessed:object, needs_human_approval:boolean }}
 */
export function witnessedFromEvent(event) {
  const resolved = resolveWitnessedAction(event.call ?? {});
  const verdict = norm(event.verdict?.kind);
  const rr = event.runtime_report ?? {};

  // The runtime truth, taken from the ledger's runtime report (hashes, never interpreted). A
  // REFUSED/ESCALATED verdict that never forwarded has no successful return.
  const blocked = verdict === "refused" || verdict === "escalated";
  const returned = rr.returned === true && !blocked;
  // Only set a `result` for a NON-success outcome. On success the witness knows only that the call
  // returned (+ a result hash) — it does NOT know the agent's semantic result ("sent", "created"),
  // so it must not fabricate one (which would false-mismatch an otherwise-truthful claim).
  let result;
  if (verdict === "refused") result = "refused";
  else if (verdict === "escalated") result = "escalated";
  else if (rr.returned === false || rr.error_hash) result = "error";

  const witnessed = {
    system: resolved.system,
    ...(resolved.app ? { app: resolved.app } : {}),
    ...(resolved.action ? { action: resolved.action } : {}),
    ...(resolved.wrapper_family ? { wrapper_family: resolved.wrapper_family } : {}),
    ...(result ? { result } : {}),
    returned,
    ...(rr.result_hash ? { result_hash: rr.result_hash } : {}),
    ...(rr.error_hash ? { error_hash: rr.error_hash } : {})
  };

  return { witnessed, needs_human_approval: verdict === "escalated" };
}

/**
 * Build a witness `run` (the input to buildWitnessedHandoff) from real witnessed events plus the
 * agent's claims. Each step pairs the agent's CLAIM (record_claim — what it SAYS it did; net-new,
 * since the content-blind proxy never stores it) with the witnessed event (what crossed the wire).
 * A claim with no witnessed event keeps `witnessed: null` — the dangerous "claimed but never seen".
 *
 * @param {object} input
 * @param {string} input.objective
 * @param {Array<{claim?:object|null, event?:object|null, user_facing?:boolean}>} input.steps
 * @param {string[]} [input.settled] @param {string[]} [input.open_questions]
 * @param {string[]} [input.next_actions] @param {string[]} [input.do_not_re_litigate]
 * @param {object|null} [input.proof_refs]
 * @returns {object} a run for buildWitnessedHandoff
 */
export function runFromWitnessedEvents(input) {
  const steps = (input.steps ?? []).map((s) => {
    const claimed = s.claim ?? null;
    if (!s.event) {
      return {
        claimed,
        witnessed: null,
        user_facing: Boolean(s.user_facing ?? claimed?.user_facing)
      };
    }
    const { witnessed, needs_human_approval } = witnessedFromEvent(s.event);
    return {
      claimed,
      witnessed,
      needs_human_approval,
      user_facing: Boolean(s.user_facing ?? claimed?.user_facing)
    };
  });

  return {
    objective: input.objective ?? "",
    steps,
    settled: input.settled ?? [],
    open_questions: input.open_questions ?? [],
    next_actions: input.next_actions ?? [],
    do_not_re_litigate: input.do_not_re_litigate ?? [],
    proof_refs: input.proof_refs ?? null
  };
}
