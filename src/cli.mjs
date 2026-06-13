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

const handoff = buildWitnessedHandoff(runFromWitnessedEvents(input));

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
