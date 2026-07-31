import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REQUIRED_HEADINGS = Object.freeze([
  "# SPEC - Lyhna One-Product Witness Waterfall v0",
  "## 1. Governing line",
  "## 2. Product boundary",
  "## 3. Canonical event envelope",
  "## 4. Evidence classes and truth rules",
  "## 5. Deterministic state ownership",
  "## 6. Review feedback lifecycle",
  "## 7. Review trigger policy",
  "## 8. Report and delivery contract",
  "## 9. Adapter waterfall",
  "## 10. Compatibility and migration",
  "## 11. Phased build",
  "## 12. Acceptance gates",
  "## 13. Loop Contract",
  "## 14. Not built in this slice"
]);

const REQUIRED_RULES = Object.freeze([
  ["canonical thesis", /THESIS\.md remains canonical/i],
  ["agent claims are not evidence", /An agent-authored event is never evidence for an action claim\./],
  ["review opinions are attributed", /A reviewer finding is attributed evaluator opinion, not witnessed fact\./],
  ["exact-head binding", /Every code review is bound to an exact repository head\./],
  ["review subject required", /Every review lifecycle event requires `subject\.repository` and `subject\.head`\./],
  ["dirty worktree identity", /A local review of uncommitted material requires `subject\.snapshot\.digest`\./],
  ["delivery distinction", /review posted != review delivered != review opened != finding addressed != new head reviewed/],
  ["shared reducer", /Only the shared Witness reducer may assign Lyhna truth labels or review lifecycle state\./],
  ["thin adapters", /Adapters capture host events, translate them into the canonical envelope, and deliver shared outputs; they do not redefine truth\./],
  ["legacy quarantine", /lyhna-core is legacy\/reference material and is not the canonical shared core\./],
  ["feedback notice", /review_available/],
  ["feedback delivery", /review_delivered/],
  ["feedback acknowledgement", /review_acknowledged/],
  ["superseded review", /review_superseded/],
  ["agent report resource", /lyhna:\/\/reviews\/\{review_id\}/],
  ["codex sources pane", /Codex Desktop Sources is the live third pane\./],
  ["codex pinned summary", /toggleable pinned summary stays visible beside the active conversation/],
  ["codex adapter", /Codex adapter/],
  ["mcp adapter", /Generic MCP adapter/],
  ["claude adapter", /Claude Code adapter/],
  ["buzz adapter", /Buzz\/Nostr adapter/]
]);

export function validateWaterfallSpec(text) {
  const errors = [];
  for (const heading of REQUIRED_HEADINGS) {
    if (!text.includes(heading)) errors.push(`missing heading: ${heading}`);
  }
  for (const [name, pattern] of REQUIRED_RULES) {
    if (!pattern.test(text)) errors.push(`missing rule: ${name}`);
  }
  return errors;
}

function defaultSpecPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "SPEC.md");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const specPath = path.resolve(process.argv[2] ?? defaultSpecPath());
  let text;
  try {
    text = readFileSync(specPath, "utf8");
  } catch (error) {
    console.error(`WATERFALL_SPEC_FAIL: cannot read ${specPath}: ${error.message}`);
    process.exitCode = 1;
  }

  if (text !== undefined) {
    const errors = validateWaterfallSpec(text);
    if (errors.length) {
      console.error("WATERFALL_SPEC_FAIL");
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`WATERFALL_SPEC_PASS: ${specPath}`);
    }
  }
}
