// Lyhna Witness — the brutal demo (BUILD-PLAN.md §9 / THESIS.md §9).
//
// Reproduces the real Hermes/Zapier failure on purpose: the agent reports a clean story; the
// witness, sitting in the tool-call path, saw something different. Run with: `npm run demo`.
// Writes the three handoff artifacts to examples/hermes-zapier/ and prints a plain-language
// readout a non-technical business owner can act on — NOT a code review.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "../src/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "examples", "hermes-zapier");

// The witness run. In production this comes from the tool-call witness in the MCP path; here it is
// a recorded sequence so the demo is deterministic and offline.
const run = {
  objective: "Draft the client onboarding doc, save it to the client's Google Drive, and confirm by email.",
  steps: [
    {
      // The agent SAID it used Google Docs directly. The witness saw it routed through Zapier.
      claimed: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
      witnessed: {
        system: "zapier",
        app: "google_docs",
        action: "create_document",
        result: "created",
        returned: true,
        wrapper_family: "zapier",
        result_hash: "sha256:9f2c…"
      }
    },
    {
      // The agent SAID it shared the doc with the client. The witness saw NO tool call at all.
      claimed: { system: "google_drive", action: "share_with_client", result: "shared", user_facing: true },
      witnessed: null
    },
    {
      // This one is clean: claim and witness agree.
      claimed: { system: "gmail", action: "send_confirmation", result: "sent", user_facing: true },
      witnessed: { system: "gmail", action: "send_confirmation", result: "sent", returned: true }
    }
  ],
  settled: ["Client onboarding template v2 is the agreed format."],
  open_questions: ["Should the client get edit access or view-only?"],
  next_actions: ["Confirm the document was actually shared before telling the client it is ready."],
  do_not_re_litigate: ["The onboarding format — already agreed with the client."]
};

const handoff = buildWitnessedHandoff(run);
const md = renderHandoffMarkdown(handoff);
const nextPrompt = renderNextAiPrompt(handoff);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "handoff.json"), JSON.stringify(handoff, null, 2) + "\n");
writeFileSync(join(outDir, "HANDOFF.md"), md);
writeFileSync(join(outDir, "next-ai-prompt.md"), nextPrompt);

// ---- plain-language readout (the "oh no, I need this" moment) ----
const line = "─".repeat(64);
const labelFlag = (s) => {
  if (s.labels.includes("CLAIMED_ACTUAL_MISMATCH")) return "⚠  MISMATCH";
  if (s.labels.includes("DO_NOT_SEND")) return "⛔ DO NOT SEND";
  if (s.labels.includes("UNSUPPORTED")) return "⛔ UNVERIFIED";
  if (s.labels.includes("SUPPORTED")) return "✅ OK";
  return s.labels.join(",");
};

console.log(line);
console.log("LYHNA WITNESSED HANDOFF — what your agent actually did");
console.log(line);
console.log(`Objective: ${handoff.objective}`);
console.log(
  `\nVerdict: ${handoff.safe_to_continue ? "✅ safe to continue" : "⛔ NOT safe to send yet"}  ` +
    `(${handoff.summary.mismatches} mismatch, ${handoff.summary.unsupported} unsupported of ${handoff.summary.total_steps} steps)\n`
);
for (const s of handoff.steps) {
  console.log(`Step ${s.index + 1} — ${labelFlag(s)}`);
  console.log(`  ${s.human_note}`);
}
console.log(`\nWhat to do next: ${handoff.next_actions[0] ?? "(none)"}`);
console.log(`Full handoff written to: examples/hermes-zapier/HANDOFF.md`);
console.log(line);
