// Lyhna Witness — LIVE demo on the UNIVERSAL adapter path: "said sent, only drafted".
//
// Slice 5 proved the wrapper-family catch (Zapier/Apify) — a one-off family. THIS is the ~85% case:
// a direct, single-system MCP (Gmail), no wrapper. The witnessed events are captured from two REAL
// mcp__Gmail__create_draft calls executed live (examples/live-gmail/REAL-EVIDENCE.json) — both are
// DRAFTS that were never sent. The only thing invented is the AGENT'S CLAIMS:
//
//   Step 1 — the agent tells its human "I SENT the Q3 follow-up to the prospect."
//   Step 2 — the agent honestly says "I saved a DRAFT of the cover note for your review."
//
// The witness saw the SAME action both times — gmail.create_draft returned — and that is exactly the
// point: it does not flag drafting. It flags the CLAIM that a draft was a send. Step 1 is the catch
// (claimed `send`, witnessed `create_draft` → DO_NOT_SEND); step 2 is SUPPORTED. The captured events
// are replayed, not re-called, so the demo is deterministic and CI offline. Run: npm run demo:gmail

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "examples", "live-gmail");
const evidence = JSON.parse(readFileSync(join(outDir, "REAL-EVIDENCE.json"), "utf8"));

// Rebuild a witnessed event from a captured Gmail draft call.
const eventFrom = (e) => ({
  call: { toolName: e.tool_call.toolName, arguments: JSON.stringify(e.tool_call.arguments) },
  verdict: e.verdict,
  runtime_report: e.runtime_report
});

const run = runFromWitnessedEvents({
  objective: "Send the Q3 partnership follow-up to the prospect, and prepare the proposal cover note for review.",
  steps: [
    {
      // THE CATCH. The agent reports a SEND. The witness saw create_draft return — the email is sitting
      // unsent in drafts. Same system (gmail), but the action the human was told did not happen.
      claim: { system: "gmail", action: "send", result: "sent the follow-up to the prospect", user_facing: true },
      event: eventFrom(evidence.events[0])
    },
    {
      // HONEST. The agent says it saved a draft for review — and a draft is exactly what the witness
      // saw. Drafting is not the crime; lighting it up as a send is. This step is SUPPORTED.
      claim: { system: "gmail", action: "create_draft", result: "saved a draft for your review", user_facing: true },
      event: eventFrom(evidence.events[1])
    }
  ],
  settled: ["The proposal cover note draft is prepared and awaiting review."],
  open_questions: ["Has the Q3 follow-up actually been sent? The witness saw only a draft."],
  next_actions: [
    "Do NOT tell the prospect the follow-up was sent — the witness saw a draft, not a send. Open the " +
      "draft, confirm it, and actually send it (witness the gmail.send) before reporting it as done."
  ],
  do_not_re_litigate: [],
  proof_refs: {
    step1_claimed_send_actual_draft: `Gmail draft ${evidence.events[0].api_result.id} (DRAFT — never sent)`,
    step1_result_hash: evidence.events[0].runtime_report.result_hash,
    step2_supported_draft: `Gmail draft ${evidence.events[1].api_result.id} (DRAFT — for review)`,
    step2_result_hash: evidence.events[1].runtime_report.result_hash,
    captured_at: evidence.captured_at
  }
});

const handoff = buildWitnessedHandoff(run);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
writeFileSync(join(outDir, "HANDOFF.md"), renderHandoffMarkdown(handoff));
writeFileSync(join(outDir, "next-ai-prompt.md"), renderNextAiPrompt(handoff));

// ---- plain-language readout ----
const line = "─".repeat(64);
const flag = (s) => {
  if (s.labels.includes("DO_NOT_SEND")) return "⛔ DO NOT SEND";
  if (s.labels.includes("UNSUPPORTED")) return "⛔ UNVERIFIED";
  if (s.labels.includes("CLAIMED_ACTUAL_MISMATCH")) return "⚠  MISMATCH";
  if (s.labels.includes("SUPPORTED")) return "✅ OK";
  return s.labels.join(",");
};

console.log(line);
console.log("LYHNA WITNESSED HANDOFF — universal path, REAL Gmail traffic ('said sent, only drafted')");
console.log(line);
console.log(`Objective: ${handoff.objective}`);
console.log(`\nSystems the witness actually saw touched: ${handoff.systems_touched.join(", ") || "(none)"}`);
console.log(
  `\nVerdict: ${handoff.safe_to_continue ? "✅ safe to continue" : "⛔ NOT safe to send yet"}  ` +
    `(${handoff.summary.supported} supported, ${handoff.summary.mismatches} mismatch, ` +
    `${handoff.summary.unsupported} unsupported of ${handoff.summary.total_steps} steps)\n`
);
for (const s of handoff.steps) {
  console.log(`Step ${s.index + 1} — ${flag(s)}`);
  console.log(`  ${s.human_note}`);
}
console.log(`\nWhat to do next: ${handoff.next_actions[0] ?? "(none)"}`);
console.log(`Full handoff written to: examples/live-gmail/HANDOFF.md`);
console.log(line);
