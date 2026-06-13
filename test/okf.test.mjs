import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildWitnessedHandoff, renderOkfBundle, OKF_LYHNA_TYPES } from "../src/index.mjs";

// A handoff that exercises every label class: a route mismatch, a claimed-but-unwitnessed user-facing
// step (UNSUPPORTED/NEEDS_EVIDENCE/DO_NOT_SEND), and a clean SUPPORTED step — plus proof refs.
function sampleHandoff() {
  return buildWitnessedHandoff({
    objective: "Draft the doc, share it, confirm by email.",
    steps: [
      {
        claimed: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
        witnessed: { system: "zapier", app: "google_docs", action: "create_document", returned: true, wrapper_family: "zapier" }
      },
      { claimed: { system: "google_drive", action: "share_with_client", result: "shared", user_facing: true }, witnessed: null },
      { claimed: { system: "gmail", action: "send", result: "sent", user_facing: true }, witnessed: { system: "gmail", action: "send", returned: true } }
    ],
    proof_refs: { doc: "https://example.com/doc", result_hash: "sha256:abc" }
  });
}

// --- minimal frontmatter helpers (no YAML dependency in this zero-dep repo) ---
function splitFrontmatter(content) {
  assert.ok(content.startsWith("---\n"), "file must begin with a YAML frontmatter block");
  const end = content.indexOf("\n---", 4);
  assert.ok(end > 0, "frontmatter block must be closed with ---");
  return { fm: content.slice(4, end), body: content.slice(end + 4) };
}
function scalarField(fm, key) {
  const m = fm.match(new RegExp(`^${key}: (.*)$`, "m"));
  if (!m) return undefined;
  const raw = m[1];
  if (raw === "true" || raw === "false") return raw === "true";
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw.startsWith('"') ? JSON.parse(raw) : raw;
}

const RESERVED = new Set(["index.md", "log.md"]);

test("OKF bundle generates the expected files", () => {
  const files = renderOkfBundle(sampleHandoff(), { name: "t" });
  for (const expected of ["index.md", "log.md", "handoffs/t.md", "steps/step-001.md", "steps/step-002.md", "steps/step-003.md", "prompts/next-ai-prompt.md"]) {
    assert.ok(files[expected] !== undefined, `missing ${expected}`);
  }
  // one label file per distinct step label
  for (const label of ["CLAIMED_ACTUAL_MISMATCH", "UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND", "SUPPORTED"]) {
    assert.ok(files[`labels/${label}.md`] !== undefined, `missing labels/${label}.md`);
  }
});

test("every markdown file has parseable frontmatter and a non-empty type", () => {
  const files = renderOkfBundle(sampleHandoff(), { name: "t" });
  for (const [p, content] of Object.entries(files)) {
    const { fm } = splitFrontmatter(content); // throws if no/!closed frontmatter (covers non-reserved too)
    const type = scalarField(fm, "type");
    assert.ok(typeof type === "string" && type.trim().length > 0, `${p} must have a non-empty type`);
  }
});

test("concept files carry their declared Lyhna types", () => {
  const files = renderOkfBundle(sampleHandoff(), { name: "t" });
  const typeOf = (p) => scalarField(splitFrontmatter(files[p]).fm, "type");
  assert.equal(typeOf("handoffs/t.md"), OKF_LYHNA_TYPES.HANDOFF);
  assert.equal(typeOf("steps/step-001.md"), OKF_LYHNA_TYPES.STEP);
  assert.equal(typeOf("labels/SUPPORTED.md"), OKF_LYHNA_TYPES.LABEL);
  assert.equal(typeOf("prompts/next-ai-prompt.md"), OKF_LYHNA_TYPES.PROMPT);
});

test("OKF output is deterministic (no clock, no randomness)", () => {
  const h = sampleHandoff();
  assert.deepEqual(renderOkfBundle(h, { name: "t" }), renderOkfBundle(h, { name: "t" }));
});

test("a timestamp appears only when supplied, never generated", () => {
  const h = sampleHandoff();
  const without = renderOkfBundle(h, { name: "t" });
  assert.doesNotMatch(without["index.md"], /^timestamp:/m);
  const withTs = renderOkfBundle(h, { name: "t", timestamp: "2026-06-13T00:00:00Z" });
  assert.equal(scalarField(splitFrontmatter(withTs["index.md"]).fm, "timestamp"), "2026-06-13T00:00:00Z");
});

test("intra-bundle markdown links resolve to generated files", () => {
  const files = renderOkfBundle(sampleHandoff(), { name: "t" });
  for (const [p, content] of Object.entries(files)) {
    const dir = path.posix.dirname(p);
    for (const m of content.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const target = path.posix.normalize(path.posix.join(dir, m[1]));
      assert.ok(files[target] !== undefined, `${p} links to missing ${m[1]} (resolved ${target})`);
    }
  }
});

test("witness facts are preserved in frontmatter (verdict, counts, labels, proof refs)", () => {
  const h = sampleHandoff();
  const files = renderOkfBundle(h, { name: "t" });
  const fm = splitFrontmatter(files["handoffs/t.md"]).fm;
  assert.equal(scalarField(fm, "safe_to_continue"), h.safe_to_continue);
  assert.equal(scalarField(fm, "safe_to_continue"), false); // this sample is not safe
  assert.equal(scalarField(fm, "summary_total_steps"), h.summary.total_steps);
  assert.equal(scalarField(fm, "summary_mismatches"), h.summary.mismatches);
  assert.equal(scalarField(fm, "summary_unsupported"), h.summary.unsupported);
  assert.equal(scalarField(fm, "summary_do_not_send"), h.summary.do_not_send);
  // distinct labels listed
  for (const label of ["CLAIMED_ACTUAL_MISMATCH", "DO_NOT_SEND", "SUPPORTED"]) {
    assert.match(fm, new RegExp(`^  - "${label}"$`, "m"));
  }
  // proof refs preserved as a nested map
  assert.match(fm, /^proof_refs:$/m);
  assert.match(fm, /^  doc: "https:\/\/example\.com\/doc"$/m);
  assert.match(fm, /^  result_hash: "sha256:abc"$/m);
});

test("a safe handoff with no proof refs omits proof_refs and reads safe", () => {
  const h = buildWitnessedHandoff({
    objective: "x",
    steps: [{ claimed: { system: "gmail", action: "send", result: "sent" }, witnessed: { system: "gmail", action: "send", returned: true } }]
  });
  const fm = splitFrontmatter(renderOkfBundle(h, { name: "ok" })["handoffs/ok.md"]).fm;
  assert.equal(scalarField(fm, "safe_to_continue"), true);
  assert.doesNotMatch(fm, /^proof_refs:/m);
});
