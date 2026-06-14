import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildWitnessedHandoff,
  renderPamBundle,
  PAM_MEMORY_TYPES,
  PAM_PROJECTION_SCHEMA
} from "../src/index.mjs";

// A handoff that exercises every label class: a route mismatch (google_docs claimed / zapier witnessed),
// a claimed-but-unwitnessed user-facing step (UNSUPPORTED/NEEDS_EVIDENCE/DO_NOT_SEND), and a clean
// SUPPORTED step — plus continuation state and proof refs.
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
    settled: ["Format v2 agreed."],
    do_not_re_litigate: ["The onboarding format."],
    open_questions: ["Edit or view access?"],
    next_actions: ["Confirm the doc was actually shared before telling the client."],
    proof_refs: { doc: "https://example.com/doc", result_hash: "sha256:abc" }
  });
}

const memoriesOf = (files) => files["memories.jsonl"].trim().split("\n").map((l) => JSON.parse(l));
const manifestOf = (files) => JSON.parse(files["manifest.json"]);

test("PAM bundle emits manifest.json, memories.jsonl, README.md", () => {
  const f = renderPamBundle(sampleHandoff(), { name: "t" });
  for (const p of ["manifest.json", "memories.jsonl", "README.md"]) {
    assert.ok(f[p] !== undefined, `missing ${p}`);
  }
  assert.equal(manifestOf(f).schema, PAM_PROJECTION_SCHEMA);
});

test("all five PAM memory classes are present", () => {
  const types = new Set(memoriesOf(renderPamBundle(sampleHandoff(), { name: "t" })).map((m) => m.memory_type));
  for (const t of Object.values(PAM_MEMORY_TYPES)) {
    assert.ok(types.has(t), `missing memory_type ${t}`);
  }
});

test("every memory item carries the carrier-vs-witness envelope (source, schema, resource, evidence_status)", () => {
  const f = renderPamBundle(sampleHandoff(), { name: "t" });
  for (const m of memoriesOf(f)) {
    assert.equal(m.source, "lyhna-witness", `${m.id} source`);
    assert.equal(m.lyhna_schema, "witnessed-handoff/v1", `${m.id} schema`);
    assert.ok(typeof m.handoff_resource === "string" && m.handoff_resource.length, `${m.id} handoff_resource`);
    assert.ok(typeof m.evidence_status === "string" && m.evidence_status.length, `${m.id} evidence_status`);
    assert.ok(typeof m.id === "string" && m.id.length, "id present");
  }
});

test("unsupported / DO_NOT_SEND claims stay unsupported memory — never upgraded into a fact", () => {
  const mems = memoriesOf(renderPamBundle(sampleHandoff(), { name: "t" }));

  // The unwitnessed user-facing share step (step 2).
  const ep = mems.find((m) => m.memory_type === "episodic" && m.step_index === 2);
  assert.ok(ep, "episodic step 2 present");
  assert.equal(ep.supported, false);
  assert.ok(ep.labels.includes("UNSUPPORTED"));
  assert.ok(ep.labels.includes("DO_NOT_SEND"));
  assert.equal(ep.witnessed, null, "the witness saw nothing — must never be fabricated");

  // It surfaces as a semantic fact about ABSENCE of evidence, not as a fact that it happened.
  const gap = mems.find((m) => m.id === "semantic:step-2-evidence-gap");
  assert.ok(gap, "semantic evidence-gap fact for step 2");
  assert.equal(gap.supported, false);
  assert.match(gap.content, /no tool call|no evidence|could not/i);

  // The honesty invariant: the unsupported action must NEVER appear inside any SUPPORTED-status item.
  for (const m of mems) {
    if (m.evidence_status === "SUPPORTED") {
      assert.doesNotMatch(JSON.stringify(m), /share_with_client/, `${m.id} must not assert the unsupported action`);
    }
  }
  // And there must be a do-not-send procedural rule for it.
  assert.ok(mems.some((m) => m.id === "procedural:do-not-send-step-2" && m.evidence_status === "DO_NOT_SEND"));
});

test("proof refs live on the manifest only — never on a per-item memory", () => {
  // The receipt's proof_refs are run-level (not bound to a step). Attaching them to a memory item
  // would let an importer read a ref as evidence for an unsupported claim — so they stay manifest-only.
  const f = renderPamBundle(sampleHandoff(), { name: "t" });
  assert.deepEqual(manifestOf(f).proof_refs, { doc: "https://example.com/doc", result_hash: "sha256:abc" });
  for (const m of memoriesOf(f)) {
    assert.equal(m.proof_refs, undefined, `${m.id} must not carry proof_refs`);
  }
});

test("mismatch labels survive the export", () => {
  const mems = memoriesOf(renderPamBundle(sampleHandoff(), { name: "t" }));
  const ep1 = mems.find((m) => m.memory_type === "episodic" && m.step_index === 1);
  assert.ok(ep1.labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.ok(
    mems.some((m) => m.memory_type === "semantic" && (m.labels || []).includes("CLAIMED_ACTUAL_MISMATCH")),
    "mismatch surfaced as a semantic fact too"
  );
});

test("an unclaimed observed failure is never given a fabricated agent claim", () => {
  // A witnessed tool call that failed, recorded with NO record_claim → UNSUPPORTED, claimed: null.
  const h = buildWitnessedHandoff({
    objective: "Run the migration.",
    steps: [{ witnessed: { system: "db", action: "migrate", returned: false } }]
  });
  const mems = memoriesOf(renderPamBundle(h, { name: "t" }));
  const ep = mems.find((m) => m.memory_type === "episodic" && m.step_index === 1);
  assert.equal(ep.claimed, null);
  assert.ok(ep.labels.includes("UNSUPPORTED"));
  // No memory anywhere — per-step OR run-level — may assert the agent claimed anything (no claim exists).
  const f = renderPamBundle(h, { name: "t" });
  assert.doesNotMatch(f["memories.jsonl"], /the agent claimed|claimed step|unspecified step/);
  // The semantic fact still exists, framed as an observed failure.
  const sem = mems.find((m) => m.id === "semantic:step-1-evidence-gap");
  assert.ok(sem);
  assert.match(sem.content, /observed|no agent claim|did not succeed/i);
});

test("a supplied timestamp appears only in the manifest, only when supplied; never auto-generated", () => {
  const without = renderPamBundle(sampleHandoff(), { name: "t" });
  assert.equal(manifestOf(without).timestamp, undefined);
  assert.doesNotMatch(without["memories.jsonl"], /timestamp/);

  const withTs = renderPamBundle(sampleHandoff(), { name: "t", timestamp: "2026-06-13T00:00:00Z" });
  assert.equal(manifestOf(withTs).timestamp, "2026-06-13T00:00:00Z");
  assert.doesNotMatch(withTs["memories.jsonl"], /timestamp/, "timestamp must not leak into per-item memory");
});

test("PAM output is deterministic (no clock, no randomness)", () => {
  const h = sampleHandoff();
  assert.deepEqual(renderPamBundle(h, { name: "t" }), renderPamBundle(h, { name: "t" }));
});

test("identity is clearly absent unless explicitly supplied; preferences are never inferred", () => {
  const absent = memoriesOf(renderPamBundle(sampleHandoff(), { name: "t" })).filter((m) => m.memory_type === "identity");
  assert.equal(absent.length, 1);
  assert.equal(absent[0].present, false);
  assert.equal(absent[0].evidence_status, "ABSENT");

  const supplied = memoriesOf(
    renderPamBundle(sampleHandoff(), { name: "t", identity: [{ key: "tone", value: "formal", scope: "client" }] })
  ).filter((m) => m.memory_type === "identity");
  assert.equal(supplied.length, 1);
  assert.equal(supplied[0].present, true);
  assert.equal(supplied[0].key, "tone");
  assert.equal(supplied[0].value, "formal");
  assert.equal(supplied[0].scope, "client");
});

test("working memory carries objective + continuation state; manifest mirrors safe_to_continue", () => {
  const f = renderPamBundle(sampleHandoff(), { name: "t" });
  const mems = memoriesOf(f);
  assert.match(mems.find((m) => m.id === "working:objective").objective, /Draft the doc/);
  assert.equal(mems.find((m) => m.id === "working:continuation-state").safe_to_continue, false);
  assert.equal(manifestOf(f).safe_to_continue, false);
  assert.deepEqual(manifestOf(f).memory_types, ["episodic", "semantic", "procedural", "working", "identity"]);
});

test("a fully clean run reads safe and ships no DO_NOT_SEND memory", () => {
  const h = buildWitnessedHandoff({
    objective: "Send the weekly summary.",
    steps: [{ claimed: { system: "gmail", action: "send", result: "sent" }, witnessed: { system: "gmail", action: "send", returned: true } }]
  });
  const f = renderPamBundle(h, { name: "ok" });
  assert.equal(manifestOf(f).safe_to_continue, true);
  const mems = memoriesOf(f);
  assert.ok(!mems.some((m) => (m.labels || []).includes("DO_NOT_SEND")));
  assert.ok(mems.some((m) => m.id === "semantic:safe-to-continue" && m.safe_to_continue === true));
});
