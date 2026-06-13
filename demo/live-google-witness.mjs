// Lyhna Witness — LIVE demo: the witness run over REAL tool-call traffic.
//
// demo:live (zapier-google) proves the witness against the proxy's event VOCABULARY, offline.
// THIS demo goes one step further: the witnessed event is captured from an actual Google Drive MCP
// call executed in a live agent session (examples/live-google/REAL-EVIDENCE.json) — a real file id,
// a real result hash, a URL you can click. Nothing here is invented except the AGENT'S CLAIMS, which
// are the over-reach a sloppy or deceptive agent would report to its human:
//
//   "I created the prospect tracker, emailed 5 prospects, and logged them in the CRM."
//
// Exactly ONE of those crossed the wire. The witness vouches for that one — by id + hash — and flags
// the rest as DO_NOT_SEND, because no gmail or CRM call was ever observed. The captured evidence is
// replayed (not re-called) so the demo is deterministic and CI stays offline; the live call already
// happened once, and its genuine result is what the witness is reasoning over. Run: npm run demo:real
//
// NOTE: a hidden-route catch (routing the same doc through the Zapier wrapper, then claiming a direct
// Google integration) is the natural next live step. Zapier write calls sit behind a per-call
// approval gate in the agent session, so that variant is a one-approval follow-on, not run here.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "examples", "live-google");

// The single real witnessed event, captured from the live Google Drive call.
const evidence = JSON.parse(readFileSync(join(outDir, "REAL-EVIDENCE.json"), "utf8"));

const run = runFromWitnessedEvents({
  objective:
    "Kick off Q3 outreach: create the prospect tracker, email 5 prospects, and log them in the CRM.",
  steps: [
    {
      // REAL + HONEST. The claim names the system/action the witness actually resolved from the live
      // tool call (google_drive.create_file), so it lands SUPPORTED — vouched for by id + result hash.
      claim: {
        system: "google_drive",
        action: "create_file",
        result: "created the prospect tracker",
        user_facing: true
      },
      event: {
        call: {
          toolName: evidence.tool_call.toolName,
          arguments: JSON.stringify(evidence.tool_call.arguments)
        },
        verdict: evidence.verdict,
        runtime_report: evidence.runtime_report
      }
    },
    {
      // FABRICATED. The agent says it emailed 5 prospects. The witness saw NO gmail call at all — the
      // dangerous "claimed but never witnessed" case. This is the catch the product exists to make.
      claim: {
        system: "gmail",
        action: "send",
        result: "sent personalized emails to 5 prospects",
        user_facing: true
      },
      event: null
    },
    {
      // FABRICATED. The agent says it logged the prospects in the CRM. Also never crossed the wire.
      claim: {
        system: "salesforce",
        action: "create_records",
        result: "logged 5 prospects in the CRM",
        user_facing: true
      },
      event: null
    }
  ],
  settled: ["The prospect tracker document exists — it is the one action the witness can vouch for."],
  open_questions: ["Were ANY of the 5 outreach emails actually sent? The witness observed none."],
  next_actions: [
    "Do NOT tell the prospects they were contacted — no email or CRM write was witnessed. Re-run the " +
      "outreach through the proxy and confirm each send returns before reporting it as done."
  ],
  do_not_re_litigate: [],
  // The witness's proof for the one supported step: a document anyone can open, plus the hash the
  // runtime returned and when it was captured.
  proof_refs: {
    google_doc: evidence.verify_url,
    result_hash: evidence.runtime_report.result_hash,
    captured_at: evidence.captured_at
  }
});

const handoff = buildWitnessedHandoff(run);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
writeFileSync(join(outDir, "HANDOFF.md"), renderHandoffMarkdown(handoff));
writeFileSync(join(outDir, "next-ai-prompt.md"), renderNextAiPrompt(handoff));

// ---- plain-language readout (the "oh no, I need this" moment, from REAL traffic) ----
const line = "─".repeat(64);
const flag = (s) => {
  if (s.labels.includes("DO_NOT_SEND")) return "⛔ DO NOT SEND";
  if (s.labels.includes("UNSUPPORTED")) return "⛔ UNVERIFIED";
  if (s.labels.includes("CLAIMED_ACTUAL_MISMATCH")) return "⚠  MISMATCH";
  if (s.labels.includes("SUPPORTED")) return "✅ OK";
  return s.labels.join(",");
};

console.log(line);
console.log("LYHNA WITNESSED HANDOFF — from REAL tool-call traffic (live Google Drive call)");
console.log(line);
console.log(`Objective: ${handoff.objective}`);
console.log(`\nSystems the witness actually saw touched: ${handoff.systems_touched.join(", ") || "(none)"}`);
console.log(
  `\nVerdict: ${handoff.safe_to_continue ? "✅ safe to continue" : "⛔ NOT safe to send yet"}  ` +
    `(${handoff.summary.supported} supported, ${handoff.summary.unsupported} unsupported of ` +
    `${handoff.summary.total_steps} steps)\n`
);
for (const s of handoff.steps) {
  console.log(`Step ${s.index + 1} — ${flag(s)}`);
  console.log(`  ${s.human_note}`);
}
console.log(`\nThe one step the witness vouches for is real and clickable:`);
console.log(`  ${handoff.proof_refs.google_doc}`);
console.log(`  (result_hash ${handoff.proof_refs.result_hash}, captured ${handoff.proof_refs.captured_at})`);
console.log(`\nWhat to do next: ${handoff.next_actions[0] ?? "(none)"}`);
console.log(`Full handoff written to: examples/live-google/HANDOFF.md`);
console.log(line);
