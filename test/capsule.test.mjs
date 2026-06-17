import { test } from "node:test";
import assert from "node:assert/strict";

import { buildWitnessedHandoff } from "../src/generate.mjs";
import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { renderCapsule, CAPSULE_SCHEMA } from "../src/capsule.mjs";

// A mixed run: one supported write, one claimed-but-unwitnessed user-facing send (DO_NOT_SEND).
const run = {
  objective: "Fix the bug and email the client.",
  steps: [
    {
      claim: { system: "filesystem", action: "write_file", result: "patched" },
      event: {
        call: { toolName: "mcp__filesystem__write_file" },
        verdict: { kind: "APPROVED" },
        runtime_report: { returned: true, result_hash: "sha256:abc" }
      }
    },
    {
      claim: { system: "gmail", action: "send", result: "emailed the client", user_facing: true },
      event: null
    }
  ]
};

const handoff = buildWitnessedHandoff(runFromWitnessedEvents(run));

test("renderCapsule emits CAPSULE.md and capsule.json", () => {
  const files = renderCapsule(handoff, { name: "demo" });
  assert.ok(files["CAPSULE.md"], "CAPSULE.md present");
  assert.ok(files["capsule.json"], "capsule.json present");
});

test("capsule.json is valid JSON carrying schema, verdict, artifacts, and the honesty ceiling", () => {
  const m = JSON.parse(renderCapsule(handoff, { name: "demo" })["capsule.json"]);
  assert.equal(m.schema, CAPSULE_SCHEMA);
  assert.equal(m.name, "demo");
  assert.equal(m.lyhna_schema, handoff.schema);
  assert.equal(m.verdict.safe_to_continue, false);
  assert.equal(m.verdict.summary.total_steps, 2);
  assert.ok(Array.isArray(m.artifacts) && m.artifacts.length >= 5);
  assert.ok(Array.isArray(m.honesty_ceiling.never_asserts) && m.honesty_ceiling.never_asserts.length > 0);
});

test("without export flags the manifest lists ONLY the trio + index, never okf/ or pam/", () => {
  const m = JSON.parse(renderCapsule(handoff, { name: "demo" })["capsule.json"]);
  const paths = m.artifacts.map((a) => a.path);
  assert.deepEqual(
    paths,
    ["CAPSULE.md", "capsule.json", "HANDOFF.md", "handoff.json", "next-ai-prompt.md"],
    "no carrier bundle is advertised when none were emitted"
  );
  assert.ok(!paths.includes("okf/"));
  assert.ok(!paths.includes("pam/"));
});

test("exports are advertised in a fixed order regardless of how the caller listed them", () => {
  const a = JSON.parse(renderCapsule(handoff, { name: "demo", exports: ["pam", "okf"] })["capsule.json"]);
  const b = JSON.parse(renderCapsule(handoff, { name: "demo", exports: ["okf", "pam"] })["capsule.json"]);
  assert.deepEqual(a, b, "manifest is order-independent in its exports list");
  const carriers = a.artifacts.map((x) => x.path).filter((p) => p === "okf/" || p === "pam/");
  assert.deepEqual(carriers, ["okf/", "pam/"]);
});

test("every artifact carries a trust boundary, and each boundary is defined in the manifest", () => {
  const m = JSON.parse(renderCapsule(handoff, { name: "demo", exports: ["okf", "pam"] })["capsule.json"]);
  for (const a of m.artifacts) {
    assert.ok(typeof a.trust_boundary === "string" && a.trust_boundary.length > 0, `${a.path} has a boundary`);
    assert.ok(m.trust_boundaries[a.trust_boundary], `boundary ${a.trust_boundary} is defined`);
  }
  // The receipt and the carriers must NOT share a boundary label — they are different kinds of object.
  const receipt = m.artifacts.find((a) => a.path === "handoff.json").trust_boundary;
  const carrier = m.artifacts.find((a) => a.path === "okf/").trust_boundary;
  assert.notEqual(receipt, carrier);
});

test("the manifest never upgrades an unsupported claim — it describes files, it does not re-assert work", () => {
  const md = renderCapsule(handoff, { name: "demo" })["CAPSULE.md"];
  // The index must reflect the not-safe verdict and restate the honesty ceiling — it must never
  // present the unsupported send as done. (The ceiling text legitimately names "an email was sent"
  // as an example of what Lyhna NEVER asserts, so we assert on the verdict + ceiling framing rather
  // than a blunt keyword scan.)
  assert.match(md, /NOT safe to continue/i);
  assert.match(md, /never asserts|does not assert/i);
  // No artifact description may claim the work succeeded.
  const m = JSON.parse(renderCapsule(handoff, { name: "demo" })["capsule.json"]);
  for (const a of m.artifacts) {
    assert.doesNotMatch(a.description, /\b(sent the email|email was sent|work is correct|delivered)\b/i);
  }
});

test("deterministic: no timestamp unless provided; identical input ⇒ identical output", () => {
  const once = renderCapsule(handoff, { name: "demo" })["capsule.json"];
  const twice = renderCapsule(handoff, { name: "demo" })["capsule.json"];
  assert.equal(once, twice);
  assert.doesNotMatch(once, /timestamp/);
  const withTs = JSON.parse(renderCapsule(handoff, { name: "demo", timestamp: "2026-06-17T00:00:00Z" })["capsule.json"]);
  assert.equal(withTs.timestamp, "2026-06-17T00:00:00Z");
});

test("CAPSULE.md cover gives a plain-language, honesty-bounded 'What this means' a buyer can act on", () => {
  const md = renderCapsule(handoff, { name: "demo" })["CAPSULE.md"];
  const meaningLine = md.split("\n").find((l) => l.includes("What this means")) ?? "";
  assert.ok(meaningLine, "the cover has a 'What this means' line");
  // Not-safe run: names the unconfirmed count and warns against sending — the line itself never says it
  // was done/sent (scoped to the line; the honesty-ceiling section legitimately names those as examples
  // of what Lyhna never asserts).
  assert.match(meaningLine, /1 of 2 claimed steps is not backed by witnessed evidence/);
  assert.match(meaningLine, /Don't treat the work as done/i);
  assert.doesNotMatch(meaningLine, /\b(was sent|is done and verified|delivered)\b/i);
  // Counts-overlap note and the "you only need HANDOFF.md" reader hint are present.
  assert.match(md, /need not add up to the step total/);
  assert.match(md, /You only need `HANDOFF\.md`/);

  // A safe run states support + the tool-level ceiling, not a business-outcome guarantee.
  const safeHandoff = buildWitnessedHandoff(
    runFromWitnessedEvents({
      objective: "Just write a file.",
      steps: [{ claim: { system: "filesystem", action: "write_file" }, event: { call: { toolName: "mcp__filesystem__write_file" }, verdict: { kind: "APPROVED" }, runtime_report: { returned: true } } }]
    })
  );
  const safeMd = renderCapsule(safeHandoff, { name: "ok" })["CAPSULE.md"];
  assert.match(safeMd, /every claimed step is backed by what the witness saw/);
  assert.match(safeMd, /not business outcomes/);
});

// REGRESSION (Codex P2 on #40): an approval-only blocker (every step SUPPORTED, but a step needs human
// approval → safe_to_continue=false with summary.supported === total_steps) must NOT read as
// "0 of N not backed by witnessed evidence" — it must name the approval hold.
test("approval-only not-safe run names the approval hold, not a false missing-evidence count", () => {
  const h = buildWitnessedHandoff({
    objective: "Refund the customer (supported, but gated on approval).",
    steps: [
      {
        claimed: { system: "stripe", action: "refund", result: "refunded" },
        witnessed: { system: "stripe", action: "refund", returned: true },
        needs_human_approval: true
      }
    ]
  });
  assert.equal(h.safe_to_continue, false);
  assert.equal(h.summary.supported, h.summary.total_steps, "all steps supported");
  const meaning = renderCapsule(h, { name: "appr" })["CAPSULE.md"].split("\n").find((l) => l.includes("What this means")) ?? "";
  assert.doesNotMatch(meaning, /not backed by witnessed evidence/);
  assert.match(meaning, /held for human approval/i);
});
