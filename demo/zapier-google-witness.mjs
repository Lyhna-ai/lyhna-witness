// Lyhna Witness — slice 5 demo: the catch, driven by the proxy's REAL event vocabulary.
//
// Where demo/hermes-zapier.mjs hand-authored the witnessed side, this one feeds the adapter the
// shapes the proxy actually produces: a witnessed McpToolCall (the wrapper tool + its arguments),
// the judgment-ledger verdict (APPROVED/ESCALATED/REFUSED), and the runtime report (returned +
// result/error hash). The adapter cracks the Zapier wrapper open exactly as the frozen
// wrapper-registry does, and the same deterministic labeler produces the handoff. Run: npm run demo:live

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "examples", "zapier-google");

// Each step pairs the agent's CLAIM (what it told the human) with the witnessed EVENT (what the
// proxy saw cross the wire). In production these events come straight off the tool-call path; here
// they are a recorded sequence so the demo is deterministic and offline.
const run = runFromWitnessedEvents({
  objective: "Create the client onboarding doc in Google, share it with the client, and confirm by email.",
  steps: [
    {
      // The agent reported the clean story: "I created it in Google Docs." The witness saw the call
      // was the Zapier wrapper tool — only by cracking its arguments does the true route appear.
      claim: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
      event: {
        call: {
          toolName: "execute_zapier_google_docs_action",
          arguments: JSON.stringify({ app: "Google Docs", action: "Create Document", title: "Client Onboarding" })
        },
        verdict: { kind: "APPROVED" },
        runtime_report: { returned: true, result_hash: "sha256:9f2c…" }
      }
    },
    {
      // The agent said it shared the doc with the client. The witness saw NO tool call for this step.
      claim: { system: "google_drive", action: "share_with_client", result: "shared", user_facing: true },
      event: null
    },
    {
      // Clean: the agent said it emailed the confirmation, and the witness saw exactly that call return.
      claim: { system: "gmail", action: "send_confirmation", result: "sent", user_facing: true },
      event: {
        call: { toolName: "gmail.send_confirmation" },
        verdict: { kind: "APPROVED" },
        runtime_report: { returned: true }
      }
    }
  ],
  settled: ["Client onboarding template v2 is the agreed format."],
  open_questions: ["Should the client get edit access or view-only?"],
  next_actions: ["Confirm the document was actually shared before telling the client it is ready."],
  do_not_re_litigate: ["The onboarding format — already agreed with the client."]
});

const handoff = buildWitnessedHandoff(run);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
writeFileSync(join(outDir, "HANDOFF.md"), renderHandoffMarkdown(handoff));
writeFileSync(join(outDir, "next-ai-prompt.md"), renderNextAiPrompt(handoff));

// ---- plain-language readout (the "oh no, I need this" moment) ----
const line = "─".repeat(64);
const flag = (s) => {
  if (s.labels.includes("CLAIMED_ACTUAL_MISMATCH") && !s.labels.includes("UNSUPPORTED")) return "⚠  MISMATCH";
  if (s.labels.includes("DO_NOT_SEND")) return "⛔ DO NOT SEND";
  if (s.labels.includes("UNSUPPORTED")) return "⛔ UNVERIFIED";
  if (s.labels.includes("SUPPORTED")) return "✅ OK";
  return s.labels.join(",");
};

console.log(line);
console.log("LYHNA WITNESSED HANDOFF — from the real tool-call path (proxy event vocabulary)");
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
console.log(`Full handoff written to: examples/zapier-google/HANDOFF.md`);
console.log(line);
