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
  ["event schema required", /`schema` is required and must equal `lyhna-event\/v1` before the event enters the reducer\./],
  ["complete v1 envelope validation", /The complete `lyhna-event\/v1` envelope is type- and enum-validated before folding/],
  ["event and actor enums", /`actor\.kind` is exactly[\s\S]*`kind` is exactly one of the lifecycle kinds/],
  ["sequence and payload types", /`sequence` is a non-negative safe integer[\s\S]*`payload` is a JSON object, not null or an array/],
  ["nested source and actor identity", /`source\.adapter`, `source\.host`, `actor\.kind`, and `actor\.id` are required non-empty fields\./],
  ["review reference required", /Every review lifecycle event requires `subject\.review_ref`\./],
  ["review scope required", /Every review lifecycle event requires `subject\.review_scope`\./],
  ["diff base currentness", /A diff-scoped review requires `subject\.base`, and its currentness key includes that exact base\./],
  ["dirty worktree identity", /From `review_started` onward, a local review of uncommitted material requires[\s\S]*`subject\.snapshot\.digest`/],
  ["single snapshot entry per path", /Each included path appears exactly once as its final inspected worktree state/],
  ["cross-language snapshot canonicalization", /RFC 8785 JSON Canonicalization Scheme \(JCS\)/],
  ["content digest encoding", /`content_digest` is `sha256:<64-lowercase-hex>` over the exact raw bytes/],
  ["sealed coverage digest", /From `review_started` onward, every review lifecycle event requires[\s\S]*`subject\.snapshot\.coverage_digest`/],
  ["canonical coverage manifest", /The coverage-manifest preimage is exactly/],
  ["coverage manifest entry shapes", /`unavailable_surfaces` and `capture_failures`[\s\S]*contain exactly[\s\S]*`excluded` and `unreadable` contain exactly/],
  ["coverage-bound snapshot", /\{ "base": <sha-or-null>, "coverage_digest": <sealed-coverage-digest>, "entries": <ordered-array>/],
  ["coverage currentness", /Review currentness is keyed by repository \+ review scope \+ head \+ applicable base \+ snapshot digest[\s\S]*\+ coverage digest\./],
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
