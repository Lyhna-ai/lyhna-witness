import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REQUIRED_HEADINGS = Object.freeze([
  "# SPEC — Lyhna Review Continuity Slice 2",
  "## 1. Scope",
  "## 2. Exact reviewed subject",
  "## 3. Persistent event fold and checkpoints",
  "## 4. Findings and inline de-duplication",
  "## 5. Report delivery, verified read, and acknowledgement",
  "## 6. Review Relay reconciliation",
  "## 7. Executable acceptance",
  "## 8. Not built in this slice"
]);

const REQUIRED_RULES = Object.freeze([
  ["canonical thesis", /`THESIS\.md` remains canonical/],
  ["exact head", /head[\s\S]*40-lowercase-hex-commit-sha/],
  ["diff base", /`pull_request_diff` requires an exact base/],
  ["checkpoint binding", /event-prefix sequence, the prefix chain digest,[\s\S]*state digest/],
  ["finding identity", /deterministic `finding_ref` is the SHA-256 of the canonical subject/],
  ["reviewer attribution", /"reviewer_ref": "stable reviewer identity"/],
  ["inline de-duplication", /never creates a second inline finding/],
  ["read-time bytes", /read `REPORT\.md` immediately/],
  ["failed read has no event", /Missing, unreadable, or altered Markdown produces no bytes and no verified-read event/],
  ["acknowledgement predecessor", /exactly one accepted predecessor: a prior successful `report_read_verified`/],
  ["availability cannot acknowledge", /Report[\s\S]*availability, generation, publication, delivery,[\s\S]*cannot substitute/],
  ["acknowledgement boundary", /does not mean the audience agreed, the finding was repaired, or the reviewed work was correct/],
  ["relay backlog deferred", /does not copy Relay's infrastructure-specific[\s\S]*backlog into this slice/],
  ["no authority", /does not approve work, block work, judge business or code correctness, or act as an[\s\S]*authority/]
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
