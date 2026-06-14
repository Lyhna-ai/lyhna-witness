import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff } from "../src/index.mjs";

// Guard for the canonical live-loop receipt — the one example whose input is NOT hand-authored but
// emitted by the real lyhna-mcp-proxy loop (demo/live-loop-witness-input.json). Two things must hold:
//   1) the committed handoff.json is exactly what the generator produces from that input (no drift,
//      the same promise the CI drift gate makes, asserted here too so a label change fails a test);
//   2) the receipt tells the honest mixed story — two SUPPORTED, one DO_NOT_SEND, NOT safe to send —
//      so a regression that quietly turned the dangerous claimed-but-never-witnessed step green would
//      turn this red.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const inputPath = path.join(root, "demo", "live-loop-witness-input.json");
const handoffPath = path.join(root, "examples", "live-loop", "handoff.json");

test("examples/live-loop/handoff.json matches a fresh render of the proxy-emitted input", () => {
  const witnessInput = JSON.parse(readFileSync(inputPath, "utf8"));
  const fresh = buildWitnessedHandoff(runFromWitnessedEvents(witnessInput));
  const committed = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.deepEqual(
    committed,
    fresh,
    "examples/live-loop is out of sync with the generator — run `npm run demo:live-loop`"
  );
});

test("the live-loop receipt tells the honest mixed story (2 supported, 1 do-not-send, not safe)", () => {
  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  assert.equal(handoff.summary.total_steps, 3);
  assert.equal(handoff.summary.supported, 2);
  assert.equal(handoff.summary.unsupported, 1);
  assert.equal(handoff.summary.mismatches, 0);
  assert.equal(handoff.safe_to_continue, false, "a claimed-but-never-witnessed user-facing step must block send");

  // The dangerous step: the agent claimed it emailed the client, the witness saw no call.
  const emailStep = handoff.steps.find((s) => s.claimed?.system === "gmail");
  assert.ok(emailStep, "expected the claimed gmail step");
  assert.equal(emailStep.witnessed, null);
  assert.ok(emailStep.labels.includes("UNSUPPORTED"));
  assert.ok(emailStep.labels.includes("DO_NOT_SEND"));

  // The witnessed work reads SUPPORTED (claim matches what crossed the wire).
  for (const system of ["filesystem", "test_runner"]) {
    const step = handoff.steps.find((s) => s.claimed?.system === system);
    assert.ok(step, `expected the ${system} step`);
    assert.ok(step.labels.includes("SUPPORTED"), `${system} step should be SUPPORTED`);
  }
});
