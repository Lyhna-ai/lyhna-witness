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

// REGRESSION (Codex P2 on #40): an observation-only step (witnessed, NO claim) must not be counted as a
// "claimed step" in the cover. A no-claim witnessed failure makes the run unsafe but is not a claim.
test("observation-only failure does not fabricate a claim count in the cover", () => {
  const h = buildWitnessedHandoff({
    objective: "An unclaimed tool call that failed.",
    steps: [{ claimed: null, witnessed: { system: "filesystem", action: "write_file", returned: false, result: "error" } }]
  });
  assert.equal(h.safe_to_continue, false);
  const meaning = renderCapsule(h, { name: "obs" })["CAPSULE.md"].split("\n").find((l) => l.includes("What this means")) ?? "";
  assert.doesNotMatch(meaning, /claimed step/i, "an observation must not be reported as a claim");
  assert.match(meaning, /not safe to continue/i);
});

// REGRESSION (Codex P2 on #40): a zero-step capsule must not assert observations that don't exist.
test("empty (zero-step) capsule does not claim any observed tool calls", () => {
  const h = buildWitnessedHandoff({ objective: "Nothing ran.", steps: [] });
  const meaning = renderCapsule(h, { name: "empty" })["CAPSULE.md"].split("\n").find((l) => l.includes("What this means")) ?? "";
  assert.match(meaning, /records no steps/i);
  assert.doesNotMatch(meaning, /recorded the observed tool calls|claimed step/i);
});

// REGRESSION (Codex P2 on #40): a route-only mismatch (CLAIMED_ACTUAL_MISMATCH, no UNSUPPORTED) WAS
// witnessed performing the action via another route — the cover must say "review", not "not backed /
// don't send", which would overstate a pure route mismatch.
test("route-only mismatch cover says review the route, not 'not backed by evidence'", () => {
  const h = buildWitnessedHandoff(
    runFromWitnessedEvents({
      objective: "Create the doc.",
      steps: [
        {
          // Agent claimed google_docs directly; witness saw zapier→google_docs do the SAME action.
          claim: { system: "google_docs", action: "create_document", result: "created" },
          event: {
            call: { toolName: "execute_zapier_google_docs_action", arguments: JSON.stringify({ app: "google_docs", action: "create_document" }) },
            verdict: { kind: "APPROVED" },
            runtime_report: { returned: true }
          }
        }
      ]
    })
  );
  assert.equal(h.safe_to_continue, false, "a route mismatch blocks safe_to_continue");
  assert.ok(h.steps[0].labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.ok(!h.steps[0].labels.includes("UNSUPPORTED"), "route-only: not unsupported");
  const meaning = renderCapsule(h, { name: "route" })["CAPSULE.md"].split("\n").find((l) => l.includes("What this means")) ?? "";
  assert.doesNotMatch(meaning, /not backed by witnessed evidence|send anything to a client/i);
  assert.match(meaning, /different route|review/i);
});

// REGRESSION (Codex P2 on #40): a not-safe run whose only blocker is an UNCLAIMED approval-gated call
// has no claims — the cover must not say "every claimed step is backed".
test("unclaimed approval-gated call does not assert a claim-level status", () => {
  const h = buildWitnessedHandoff({
    objective: "An unclaimed escalated call.",
    steps: [{ claimed: null, witnessed: { system: "stripe", action: "refund", returned: false, result: "escalated" }, needs_human_approval: true }]
  });
  assert.equal(h.safe_to_continue, false);
  const meaning = renderCapsule(h, { name: "u" })["CAPSULE.md"].split("\n").find((l) => l.includes("What this means")) ?? "";
  assert.doesNotMatch(meaning, /every claimed step|claimed step/i);
  assert.match(meaning, /not safe to continue/i);
});
