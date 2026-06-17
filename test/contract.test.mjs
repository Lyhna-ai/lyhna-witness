import { test } from "node:test";
import assert from "node:assert/strict";

import { buildWitnessedHandoff } from "../src/generate.mjs";
import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import {
  statusFromLabels,
  actionFamily,
  observedResultState,
  claimedResultState,
  resolveLink,
  hasContractSignal,
  CONTRACT_STATUS
} from "../src/contract.mjs";

const approved = (toolName, extra = {}) => ({
  call: { toolName },
  verdict: { kind: "APPROVED" },
  runtime_report: { returned: true, result_hash: "sha256:x" },
  ...extra
});

// ---- unit: status roll-up ----
test("statusFromLabels rolls labels into one agent-facing status, fail-safe by default", () => {
  assert.equal(statusFromLabels(["SUPPORTED"]), CONTRACT_STATUS.SUPPORTED);
  assert.equal(statusFromLabels(["UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"]), CONTRACT_STATUS.UNSUPPORTED);
  assert.equal(statusFromLabels(["CLAIMED_ACTUAL_MISMATCH"]), CONTRACT_STATUS.MISMATCH);
  // An action/result mismatch is ALSO unsupported — unsupported wins (the stronger safety signal).
  assert.equal(statusFromLabels(["CLAIMED_ACTUAL_MISMATCH", "UNSUPPORTED"]), CONTRACT_STATUS.UNSUPPORTED);
  // A human gate leads regardless of co-labels.
  assert.equal(statusFromLabels(["UNSUPPORTED", "NEEDS_HUMAN_APPROVAL"]), CONTRACT_STATUS.NEEDS_APPROVAL);
  // Unknown / empty never reads as supported.
  assert.equal(statusFromLabels([]), CONTRACT_STATUS.NEEDS_EVIDENCE);
});

test("action families are coarse and never invented", () => {
  assert.equal(actionFamily("send"), "send");
  assert.equal(actionFamily("create_draft"), "write");
  assert.equal(actionFamily("write_file"), "write");
  assert.equal(actionFamily("run_tests"), "execute");
  assert.equal(actionFamily("read_file"), "read");
  assert.equal(actionFamily("frobnicate"), "other");
  assert.equal(actionFamily(undefined), null);
});

test("observed_result_state never claims success — only what the witness recorded", () => {
  assert.equal(observedResultState(null), "no_observed_call");
  assert.equal(observedResultState({ returned: true }), "returned");
  assert.equal(observedResultState({ result: "refused", returned: false }), "blocked_refused");
  assert.equal(observedResultState({ result: "escalated", returned: false }), "blocked_escalated");
  assert.equal(observedResultState({ returned: false }), "error");
  assert.equal(claimedResultState(null), null);
  assert.equal(claimedResultState({ result: "done" }), "claimed_completed");
  assert.equal(claimedResultState({}), "claimed_attempted");
});

// ---- unit: link resolution ----
test("resolveLink: explicit ids beat ordinal; a conflict is detected and fails safe", () => {
  assert.deepEqual(resolveLink({ claim: { claim_turn_id: "t1" }, event: { turn_ref: "t1" } }), {
    basis: "explicit",
    conflict: false
  });
  assert.deepEqual(resolveLink({ claim: { claim_turn_id: "t1" }, event: { turn_ref: "t2" } }), {
    basis: "conflict",
    conflict: true
  });
  assert.deepEqual(resolveLink({ claim: { system: "x" }, event: {} }), { basis: "ordinal", conflict: false });
  assert.deepEqual(resolveLink({ claim: { system: "x" } }), { basis: "unwitnessed", conflict: false });
  assert.deepEqual(resolveLink({ event: {} }), { basis: "observation", conflict: false });
});

test("hasContractSignal: a plain run has none; an agent_id / loop id flips it on", () => {
  assert.equal(hasContractSignal({ steps: [{ claim: { system: "gmail" }, event: null }] }), false);
  assert.equal(hasContractSignal({ steps: [{ agent_id: "research", claim: { system: "fs" } }] }), true);
  assert.equal(hasContractSignal({ parent_loop_id: "loop-1", steps: [] }), true);
});

// ---- integration: backward compatibility ----
test("a run with NO spine signal produces NO contract block and no run-level spine fields", () => {
  const h = buildWitnessedHandoff(
    runFromWitnessedEvents({
      objective: "Plain run",
      steps: [{ claim: { system: "filesystem", action: "write_file" }, event: approved("mcp__filesystem__write_file") }]
    })
  );
  assert.equal(h.steps[0].contract, undefined, "no contract on a plain step");
  assert.equal(h.agents, undefined, "no agents summary on a plain run");
  assert.equal(h.parent_loop_id, undefined);
});

// ---- integration: spine-enabled multi-agent attribution ----
const multiAgentInput = {
  objective: "Parent dispatches research + writer subagents.",
  parent_loop_id: "loop-42",
  receipt_id: "rcpt-7",
  steps: [
    {
      agent_id: "research-1",
      subagent_role: "research",
      claim: { system: "filesystem", action: "read_file", result: "read the spec", claim_id: "c1", claim_turn_id: "t1" },
      event: approved("mcp__filesystem__read_file", { turn_ref: "t1", call: { toolName: "mcp__filesystem__read_file", call_id: "call-1" } })
    },
    {
      // Research agent ALSO claims it checked a second file, but Lyhna saw no call for that claim.
      agent_id: "research-1",
      subagent_role: "research",
      claim: { system: "filesystem", action: "read_file", result: "checked the config too", claim_id: "c2" },
      event: null
    },
    {
      // Writer drafted the email (witnessed) but claimed a SEND (user-facing) → DO_NOT_SEND.
      agent_id: "writer-1",
      subagent_role: "writer",
      claim: { system: "gmail", action: "send", result: "emailed the client", user_facing: true, claim_id: "c3" },
      event: null
    }
  ]
};

test("spine-enabled run attaches a contract to every step with status + reader_explanation", () => {
  const h = buildWitnessedHandoff(runFromWitnessedEvents(multiAgentInput));
  assert.equal(h.parent_loop_id, "loop-42");
  assert.equal(h.receipt_id, "rcpt-7");
  for (const s of h.steps) {
    assert.ok(s.contract, `step ${s.index + 1} has a contract`);
    assert.ok(typeof s.contract.status === "string");
    assert.ok(typeof s.contract.reader_explanation === "string" && s.contract.reader_explanation.length > 0);
  }
  // Step 1: witnessed read, explicit link → supported.
  assert.equal(h.steps[0].contract.status, CONTRACT_STATUS.SUPPORTED);
  assert.equal(h.steps[0].contract.link_basis, "explicit");
  assert.equal(h.steps[0].contract.agent_id, "research-1");
  assert.equal(h.steps[0].contract.call_id, "call-1");
  // Step 2: unsupported subagent branch STAYS unsupported.
  assert.equal(h.steps[1].contract.status, CONTRACT_STATUS.UNSUPPORTED);
  assert.match(h.steps[1].contract.reader_explanation, /research agent/i);
  // Step 3: writer's claimed send is unsupported / do-not-send.
  assert.equal(h.steps[2].contract.status, CONTRACT_STATUS.UNSUPPORTED);
  assert.ok(h.steps[2].labels.includes("DO_NOT_SEND"));
});

test("agents summary attributes unsupported branches to the right agent (captured evidence only)", () => {
  const h = buildWitnessedHandoff(runFromWitnessedEvents(multiAgentInput));
  const research = h.agents.find((a) => a.agent_id === "research-1");
  const writer = h.agents.find((a) => a.agent_id === "writer-1");
  assert.ok(research && writer);
  assert.deepEqual(research.steps, [1, 2]);
  assert.equal(research.has_unsupported, true, "research has one unsupported branch");
  assert.equal(writer.has_unsupported, true);
});

test("optional artifact_id is absent unless supplied — never fabricated", () => {
  const h = buildWitnessedHandoff(runFromWitnessedEvents(multiAgentInput));
  assert.equal(h.steps[0].contract.artifact_id, undefined);
  const withArtifact = buildWitnessedHandoff(
    runFromWitnessedEvents({
      objective: "x",
      steps: [{ agent_id: "a1", artifact_id: "art-9", claim: { system: "fs", action: "write_file" }, event: approved("mcp__fs__write_file") }]
    })
  );
  assert.equal(withArtifact.steps[0].contract.artifact_id, "art-9");
});

// ---- regression: explicit link beats ordinal, missing link fails safe ----
test("REGRESSION: a conflicting explicit link drops the witnessed call (claim fails safe to unsupported)", () => {
  // The supplied call belongs to turn t9, but the claim is for turn t1 → the call must NOT vouch for
  // this claim. Without the explicit-link check, ordinal pairing would have marked it supported.
  const h = buildWitnessedHandoff(
    runFromWitnessedEvents({
      objective: "Conflicting link",
      steps: [
        {
          agent_id: "a1",
          claim: { system: "filesystem", action: "write_file", result: "wrote it", claim_turn_id: "t1" },
          event: approved("mcp__filesystem__write_file", { turn_ref: "t9" })
        }
      ]
    })
  );
  assert.equal(h.steps[0].witnessed, null, "the mis-linked call is dropped");
  assert.equal(h.steps[0].contract.status, CONTRACT_STATUS.UNSUPPORTED);
  assert.equal(h.steps[0].contract.link_basis, "conflict");
  assert.equal(h.safe_to_continue, false, "a broken link fails safe");
});

test("REGRESSION: reader_explanation stays bounded to witnessed evidence (no fabricated success)", () => {
  const h = buildWitnessedHandoff(runFromWitnessedEvents(multiAgentInput));
  // The unsupported send must not read as sent/done anywhere in its explanation.
  assert.doesNotMatch(h.steps[2].contract.reader_explanation, /\b(sent|delivered|done|succeeded)\b/i);
  assert.match(h.steps[2].contract.reader_explanation, /no tool call|no evidence|witness saw/i);
});
