import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff } from "../src/index.mjs";

// Guard for the agent-team capsule — the example that showcases the claim-to-action spine attributing
// claims across a parent + two subagents, including an UNWITNESSED branch. Two things must hold:
//   1) the committed handoff.json is exactly what the generator produces (no drift);
//   2) the receipt tells the honest multi-agent story — supported research read, an unwitnessed research
//      branch, the writer's said-send/saw-draft mismatch, the parent's unsupported completion claim —
//      so a regression that laundered any of those into "supported" turns this red.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const inputPath = path.join(root, "demo", "agent-team-witness-input.json");
const handoffPath = path.join(root, "examples", "agent-team", "handoff.json");

test("examples/agent-team/handoff.json matches a fresh render of the input", () => {
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const fresh = buildWitnessedHandoff(runFromWitnessedEvents(input));
  const committed = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.deepEqual(committed, fresh, "examples/agent-team is out of sync — run `npm run demo:agent-team`");
});

test("the agent-team receipt tells the honest multi-agent story", () => {
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(h.safe_to_continue, false);
  assert.equal(h.parent_loop_id, "loop-q2-client-report");
  assert.equal(h.receipt_id, "rcpt-q2-2026-0617");

  // Step 1: research read, explicitly linked → supported.
  assert.equal(h.steps[0].contract.status, "supported");
  assert.equal(h.steps[0].contract.link_basis, "explicit");
  // Step 2: the unwitnessed research branch stays unsupported.
  assert.equal(h.steps[1].contract.status, "unsupported");
  assert.equal(h.steps[1].contract.link_basis, "unwitnessed");
  assert.equal(h.steps[1].witnessed, null);
  // Step 3: said-send / saw-draft mismatch, do-not-send.
  assert.ok(h.steps[2].labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.ok(h.steps[2].labels.includes("DO_NOT_SEND"));
  assert.equal(h.steps[2].contract.claimed_action_family, "send");
  assert.equal(h.steps[2].contract.observed_action_family, "write");
  // Step 4: parent's completion claim is unsupported / do-not-send.
  assert.ok(h.steps[3].labels.includes("DO_NOT_SEND"));
});

test("every agent in the summary is attributed and none is over-reported as fully supported", () => {
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  const ids = h.agents.map((a) => a.agent_id).sort();
  assert.deepEqual(ids, ["orchestrator-1", "research-1", "writer-1"]);
  // No agent in this scenario is fully supported (each has an unsupported/mismatch branch).
  for (const a of h.agents) {
    assert.equal(a.all_supported, false, `${a.agent_id} must not read as all-supported`);
    assert.ok((a.nonsupported_statuses ?? []).length > 0);
  }
});
