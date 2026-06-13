import { test } from "node:test";
import assert from "node:assert/strict";

import {
  WITNESSED_HANDOFF_SCHEMA,
  buildWitnessedHandoff,
  renderHandoffMarkdown,
  renderNextAiPrompt
} from "../src/generate.mjs";

// The canonical Hermes/Zapier run: a path mismatch, a dangerous unwitnessed claim, and a clean step.
function hermesRun() {
  return {
    objective: "Draft the client onboarding doc and share it with the client.",
    steps: [
      {
        claimed: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
        witnessed: {
          system: "zapier",
          app: "google_docs",
          action: "create_document",
          result: "created",
          returned: true,
          wrapper_family: "zapier",
          result_hash: "sha256:abc"
        }
      },
      {
        claimed: { system: "google_drive", action: "share_with_client", result: "shared", user_facing: true },
        witnessed: null
      },
      {
        claimed: { system: "gmail", action: "send_confirmation", result: "sent", user_facing: true },
        witnessed: { system: "gmail", action: "send_confirmation", result: "sent", returned: true }
      }
    ],
    settled: ["Client onboarding template v2 is the agreed format."],
    open_questions: ["View-only or edit access for the client?"],
    next_actions: ["Confirm the share actually happened before telling the client it is ready."],
    do_not_re_litigate: ["The onboarding format — already agreed."]
  };
}

test("builds witnessed-handoff/v1 with the expected per-step labels", () => {
  const h = buildWitnessedHandoff(hermesRun());
  assert.equal(h.schema, WITNESSED_HANDOFF_SCHEMA);
  assert.ok(h.steps[0].labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.ok(h.steps[1].labels.includes("UNSUPPORTED"));
  assert.ok(h.steps[1].labels.includes("DO_NOT_SEND"));
  assert.deepEqual(h.steps[2].labels, ["SUPPORTED"]);
});

test("safe_to_continue is false when any step is DO_NOT_SEND / UNSUPPORTED", () => {
  const h = buildWitnessedHandoff(hermesRun());
  assert.equal(h.safe_to_continue, false);
  assert.equal(h.summary.mismatches, 1);
  assert.equal(h.summary.do_not_send, 1);
  assert.deepEqual(h.systems_touched, ["zapier", "gmail"]);
});

test("a fully clean run is safe_to_continue", () => {
  const h = buildWitnessedHandoff({
    objective: "Send the weekly summary.",
    steps: [
      {
        claimed: { system: "gmail", action: "send", result: "sent", user_facing: true },
        witnessed: { system: "gmail", action: "send", result: "sent", returned: true }
      }
    ]
  });
  assert.equal(h.safe_to_continue, true);
  assert.equal(h.summary.supported, 1);
});

test("HANDOFF.md is human-readable: surfaces verdict, mismatch, and the unwitnessed claim", () => {
  const md = renderHandoffMarkdown(buildWitnessedHandoff(hermesRun()));
  assert.match(md, /# Witnessed Handoff/);
  assert.match(md, /NOT safe to continue/i);
  assert.match(md, /## Mismatches/);
  assert.match(md, /zapier/i);
  assert.match(md, /no tool call/i); // the share that never happened
  assert.match(md, /## Do Not Re-Litigate/);
});

test("next-ai-prompt carries settled state and the unverified steps", () => {
  const p = renderNextAiPrompt(buildWitnessedHandoff(hermesRun()));
  assert.match(p, /SETTLED/);
  assert.match(p, /onboarding/i);
  assert.match(p, /UNVERIFIED/);
  assert.match(p, /NOT safe to send/i);
});

test("generation is deterministic (no clock / no randomness)", () => {
  const a = JSON.stringify(buildWitnessedHandoff(hermesRun()));
  const b = JSON.stringify(buildWitnessedHandoff(hermesRun()));
  assert.equal(a, b);
});
