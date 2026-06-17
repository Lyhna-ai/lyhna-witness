// Lyhna Witness — the canonical LIVE-LOOP receipt (Lane B).
//
// Every other demo in this directory hand-authors its witness input. This one does NOT: it reads
// `demo/live-loop-witness-input.json`, a file emitted by the real lyhna-mcp-proxy standing-service
// loop (open scoped loop → agent routes MCP tool calls AND records its own claims → supervisor seals
// → export-pack pairs claims with the witnessed judgment turns). That JSON is the proxy half of
// claimed-vs-actual; here the witness renders it into the human receipt with the SAME deterministic
// labeler the product ships. So this example is proof the receipt is produced by the loop, not typed
// by hand. Run: npm run demo:live-loop
//
// To refresh the input from the proxy: in lyhna-mcp-proxy run `npm run build && npm run demo:live-loop`
// and copy its examples/live-loop/witness-input.json over demo/live-loop-witness-input.json here.
//
// HONESTY / V1 CEILING: the witness is action-level only — it compares what crossed the tool boundary
// to what the agent claimed. It does not judge whether the work was good, and does not verify outcomes
// outside the observed path. The scenario is honestly mixed: the file write and test run were both
// witnessed AND claimed (SUPPORTED); the agent also claimed it emailed the client the invoice but made
// no email tool call, so the witness saw nothing (UNSUPPORTED / DO_NOT_SEND).

import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt, renderOkfBundle, renderPamBundle, renderCapsule } from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const inputPath = join(here, "live-loop-witness-input.json");
const outDir = join(here, "..", "examples", "live-loop");

// The witness input as the proxy's export-pack actually emitted it — read from disk, not inlined.
const witnessInput = JSON.parse(readFileSync(inputPath, "utf8"));

const handoff = buildWitnessedHandoff(runFromWitnessedEvents(witnessInput));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
writeFileSync(join(outDir, "HANDOFF.md"), renderHandoffMarkdown(handoff));
writeFileSync(join(outDir, "next-ai-prompt.md"), renderNextAiPrompt(handoff));

// Additive OKF export: the same witnessed handoff projected into an OKF-compatible bundle. Deterministic
// — no timestamp is passed, so none is written. Clear the dir first so a vanished step/label leaves no
// stale file (the drift gate only diffs tracked files).
const okf = renderOkfBundle(handoff, { name: "live-loop" });
rmSync(join(outDir, "okf"), { recursive: true, force: true });
for (const [relPath, contents] of Object.entries(okf)) {
  const dest = join(outDir, "okf", relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contents);
}

// Additive PAM export: the same witnessed handoff projected into a PAM-shaped memory bundle beside okf/.
// Deterministic — no timestamp passed. Every memory item carries its evidence_status, so the receipt
// travels as portable memory without shedding the honesty ceiling (PAM is the container; Lyhna is the
// witness). Clear the dir first so a vanished item leaves no stale file.
const pam = renderPamBundle(handoff, { name: "live-loop" });
rmSync(join(outDir, "pam"), { recursive: true, force: true });
for (const [relPath, contents] of Object.entries(pam)) {
  const dest = join(outDir, "pam", relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contents);
}

// Capsule index: the bundle's self-describing table of contents (CAPSULE.md + capsule.json), naming
// every artifact and the trust boundary it carries. This run emits both carriers, so the index lists
// okf/ and pam/. Deterministic — no timestamp passed.
const capsule = renderCapsule(handoff, { name: "live-loop", exports: ["okf", "pam"] });
for (const [relPath, contents] of Object.entries(capsule)) {
  writeFileSync(join(outDir, relPath), contents);
}

// ---- plain-language readout ----
const line = "─".repeat(64);
const flag = (s) => {
  if (s.labels.includes("CLAIMED_ACTUAL_MISMATCH") && !s.labels.includes("UNSUPPORTED")) return "⚠  MISMATCH";
  if (s.labels.includes("DO_NOT_SEND")) return "⛔ DO NOT SEND";
  if (s.labels.includes("UNSUPPORTED")) return "⛔ UNVERIFIED";
  if (s.labels.includes("SUPPORTED")) return "✅ OK";
  return s.labels.join(",");
};

console.log(line);
console.log("LYHNA WITNESSED HANDOFF — from the REAL standing-service loop (proxy export-pack)");
console.log(line);
console.log(`Objective: ${handoff.objective}`);
console.log(`\nSystems the witness saw touched: ${handoff.systems_touched.join(", ")}`);
console.log(
  `\nVerdict: ${handoff.safe_to_continue ? "✅ safe to continue" : "⛔ NOT safe to send yet"}  ` +
    `(${handoff.summary.mismatches} mismatch, ${handoff.summary.unsupported} unsupported of ${handoff.summary.total_steps} steps)\n`
);
for (const s of handoff.steps) {
  console.log(`Step ${s.index + 1} — ${flag(s)}`);
  console.log(`  ${s.human_note}`);
}
console.log(`\nWhat to do next: ${handoff.next_actions[0] ?? "(none)"}`);
console.log(`Full handoff written to: examples/live-loop/HANDOFF.md`);
console.log(line);
