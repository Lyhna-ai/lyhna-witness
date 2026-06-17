// Lyhna Witness — the AGENT-TEAM capsule (parent + subagents, with an unwitnessed branch).
//
// This example shows the claim-to-action spine doing the one thing a multi-agent capsule must: attribute
// each claim to the agent that made it, from CAPTURED EVIDENCE ONLY, without Lyhna pretending to
// orchestrate the swarm. It reads demo/agent-team-witness-input.json (the shape the proxy's export-pack
// would emit, with the spine identifiers the proxy supplies) and renders the full capsule.
//
// The scenario is honestly mixed across three agents:
//   - research subagent: read the spec (witnessed, explicitly linked) → SUPPORTED; ALSO claimed it
//     checked the pricing config, but the witness saw no call for that claim → UNSUPPORTED (the
//     unwitnessed branch — "Lyhna saw no file read for that agent").
//   - writer subagent: claimed it SENT the client the report, but the witness saw gmail.create_draft →
//     CLAIMED_ACTUAL_MISMATCH + DO_NOT_SEND ("drafted, not sent").
//   - parent/orchestrator: claimed it told the client the report is complete and sent, but the witness
//     saw no call → UNSUPPORTED / DO_NOT_SEND ("parent claimed complete, but a branch is unsupported").
//
// HONESTY / V1 CEILING: action-level only. The capsule attributes claims to agents and links them to the
// witnessed calls it has; it never asserts an outcome happened or that every subagent was captured.
// Run: npm run demo:agent-team

import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import {
  buildWitnessedHandoff,
  renderHandoffMarkdown,
  renderNextAiPrompt,
  renderOkfBundle,
  renderPamBundle,
  renderCapsule
} from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const inputPath = join(here, "agent-team-witness-input.json");
const outDir = join(here, "..", "examples", "agent-team");

const witnessInput = JSON.parse(readFileSync(inputPath, "utf8"));
const handoff = buildWitnessedHandoff(runFromWitnessedEvents(witnessInput));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
writeFileSync(join(outDir, "HANDOFF.md"), renderHandoffMarkdown(handoff));
writeFileSync(join(outDir, "next-ai-prompt.md"), renderNextAiPrompt(handoff));

// OKF + PAM projections (deterministic — no timestamp passed). Clear each dir first so a vanished
// step/label/item leaves no stale file (the drift gate only diffs tracked files).
const okf = renderOkfBundle(handoff, { name: "agent-team" });
rmSync(join(outDir, "okf"), { recursive: true, force: true });
for (const [relPath, contents] of Object.entries(okf)) {
  const dest = join(outDir, "okf", relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contents);
}

const pam = renderPamBundle(handoff, { name: "agent-team" });
rmSync(join(outDir, "pam"), { recursive: true, force: true });
for (const [relPath, contents] of Object.entries(pam)) {
  const dest = join(outDir, "pam", relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contents);
}

// Capsule index: the bundle's self-describing table of contents. This run emits both carriers, so the
// index lists okf/ and pam/, plus the run-level spine and the per-agent attribution.
const capsule = renderCapsule(handoff, { name: "agent-team", exports: ["okf", "pam"] });
for (const [relPath, contents] of Object.entries(capsule)) {
  writeFileSync(join(outDir, relPath), contents);
}

// ---- plain-language readout ----
const line = "─".repeat(64);
console.log(line);
console.log("LYHNA AGENT-TEAM CAPSULE — parent + subagents, claim-to-action spine");
console.log(line);
console.log(`Objective: ${handoff.objective}`);
console.log(`\nVerdict: ${handoff.safe_to_continue ? "✅ safe to continue" : "⛔ NOT safe to send yet"}`);
console.log(`Parent loop: ${handoff.parent_loop_id} · receipt: ${handoff.receipt_id}\n`);
console.log("Agents (captured evidence only):");
for (const a of handoff.agents) {
  const flag = a.all_supported ? "all attributed steps supported" : `not all supported (${a.nonsupported_statuses.join(", ")})`;
  console.log(`  - ${a.subagent_role ? `${a.subagent_role} agent` : a.agent_id} (${a.agent_id}): steps ${a.steps.join(", ")} — ${flag}`);
}
console.log(`\nFull capsule written to: examples/agent-team/ (start at CAPSULE.md)`);
console.log(line);
