#!/usr/bin/env node
// Lyhna Witness — CLI seam (thesis §7 `lyhna.export_handoff`).
//
// Turns a captured run — the agent's CLAIMS paired with the WITNESSED tool-call events — into the
// handoff trio (handoff.json, HANDOFF.md, next-ai-prompt.md). This is the boundary the runtime
// (lyhna-mcp-proxy) calls at loop close: it writes what it captured as one JSON, invokes this, and
// gets back the human face + machine prompt. The witness stays the canonical owner of the
// claimed-vs-actual labels; the proxy owns capture. No model calls, no clock — deterministic.
//
// Usage:
//   lyhna-witness <input.json> [outDir]      input is a runFromWitnessedEvents() payload:
//                                            { objective, steps:[{claim, event, user_facing}],
//                                              settled?, open_questions?, next_actions?,
//                                              do_not_re_litigate?, proof_refs? }
//   lyhna-witness <input.json> [outDir] --gate   exit 3 when the handoff is NOT safe_to_continue,
//                                                 so a caller can fail-closed on DO_NOT_SEND.
//   lyhna-witness -                          read the input JSON from stdin instead of a file.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { runFromWitnessedEvents } from "./witnessed-event.mjs";
import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "./generate.mjs";

function fail(message, code = 2) {
  process.stderr.write(`lyhna-witness: ${message}\n`);
  process.exit(code);
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// This CLI is the fail-CLOSED runtime seam for captured events. Validate every step (and its claim /
// event / call shape) BEFORE building the handoff — do not rely on runFromWitnessedEvents to throw.
// Some malformed-but-valid payloads do not throw: e.g. `{steps:[{event:"bad"}]}` would otherwise be
// recorded as an observed step with an empty system, labeled SUPPORTED, and pass --gate. A dropped
// or malformed capture must fail closed, never read as safe.
function validateSteps(steps) {
  steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!isPlainObject(s)) fail(`${at} must be an object`);
    const hasClaim = s.claim !== undefined && s.claim !== null;
    const hasEvent = s.event !== undefined && s.event !== null;
    if (!hasClaim && !hasEvent) fail(`${at} must have a claim or an event (a step with neither is a dropped capture)`);
    if (hasClaim) {
      if (!isPlainObject(s.claim)) fail(`${at}.claim must be an object or null`);
      if (!isNonEmptyString(s.claim.system)) fail(`${at}.claim.system must be a non-empty string`);
    }
    if (hasEvent) {
      const e = s.event;
      if (!isPlainObject(e)) fail(`${at}.event must be an object or null`);
      if (!isPlainObject(e.call) || !isNonEmptyString(e.call.toolName)) {
        fail(`${at}.event.call.toolName must be a non-empty string`);
      }
      // A proxy-captured event always carries a judgment verdict. Require it — a truncated event with
      // no verdict would otherwise be treated as a bare observation and read as safe.
      if (!isPlainObject(e.verdict) || !isNonEmptyString(e.verdict.kind)) {
        fail(`${at}.event.verdict.kind must be a non-empty string`);
      }
      if (e.runtime_report !== undefined && e.runtime_report !== null && !isPlainObject(e.runtime_report)) {
        fail(`${at}.event.runtime_report must be an object`);
      }
      // An APPROVED (forwarded) call always has a runtime report with a boolean `returned` — that is
      // the result the witness vouches on. Require it; absence means a truncated capture, not success.
      // A blocked verdict (REFUSED/ESCALATED) legitimately has no runtime report.
      if (e.verdict.kind.trim().toLowerCase() === "approved") {
        if (!isPlainObject(e.runtime_report) || typeof e.runtime_report.returned !== "boolean") {
          fail(`${at}.event.runtime_report.returned (boolean) is required for an APPROVED event`);
        }
      }
    }
  });
}

const argv = process.argv.slice(2);
const gate = argv.includes("--gate");
const positional = argv.filter((a) => a !== "--gate");
const inputPath = positional[0];
const outDir = positional[1] ?? ".";

if (!inputPath) {
  fail("usage: lyhna-witness <input.json|-> [outDir] [--gate]");
}

let raw;
try {
  raw = readFileSync(inputPath === "-" ? 0 : inputPath, "utf8");
} catch (err) {
  fail(`cannot read input '${inputPath}': ${err.message}`);
}

let input;
try {
  input = JSON.parse(raw);
} catch (err) {
  fail(`input is not valid JSON: ${err.message}`);
}
if (input === null || typeof input !== "object" || Array.isArray(input)) {
  fail("input must be a JSON object (a runFromWitnessedEvents payload)");
}
// `steps` must be PRESENT and an array. A missing steps field is treated as a dropped/malformed
// capture and fails closed — never let it default to [] and emit a SAFE_TO_CONTINUE handoff from
// nothing (a fail-open at the safety boundary). An explicit [] is a deliberate zero-step run.
if (!Array.isArray(input.steps)) {
  fail("input.steps is required and must be an array of { claim, event } steps");
}
validateSteps(input.steps);

// Backstop: even after structural validation, fail predictably rather than as an internal stack
// trace if the deterministic build rejects something validation did not anticipate.
let handoff;
try {
  handoff = buildWitnessedHandoff(runFromWitnessedEvents(input));
} catch (err) {
  fail(`input is not a valid witness payload: ${err.message}`);
}

try {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
  writeFileSync(join(outDir, "HANDOFF.md"), renderHandoffMarkdown(handoff));
  writeFileSync(join(outDir, "next-ai-prompt.md"), renderNextAiPrompt(handoff));
} catch (err) {
  fail(`cannot write handoff to '${outDir}': ${err.message}`);
}

const s = handoff.summary;
process.stdout.write(
  `${handoff.safe_to_continue ? "SAFE_TO_CONTINUE" : "DO_NOT_CONTINUE"} — ` +
    `${s.total_steps} steps · ${s.supported} supported · ${s.mismatches} mismatch · ` +
    `${s.unsupported} unsupported · ${s.do_not_send} do-not-send → ${outDir}/HANDOFF.md\n`
);

// Fail-closed when asked to gate: a non-safe handoff (DO_NOT_SEND / unsupported / needs-approval)
// returns a distinct non-zero code so a runtime can block continuation on it.
if (gate && !handoff.safe_to_continue) process.exit(3);
