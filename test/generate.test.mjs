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
  // The wrapped app (google_docs, seen under the zapier wrapper) is inventoried too, not just the route.
  assert.deepEqual(h.systems_touched, ["zapier", "google_docs", "gmail"]);
});

test("safe_to_continue is false while a step still NEEDS_HUMAN_APPROVAL", () => {
  const h = buildWitnessedHandoff({
    objective: "Refund the customer.",
    steps: [
      {
        needs_human_approval: true,
        claimed: { system: "stripe", action: "refund", result: "refunded" },
        witnessed: { system: "stripe", action: "refund", result: "refunded", returned: true }
      }
    ]
  });
  // Every label-level check passes (supported, no do-not-send), but a human still has to sign off,
  // so the handoff must NOT tell the next AI it is safe to proceed.
  assert.deepEqual(h.needs_human_approval, [0]);
  assert.equal(h.safe_to_continue, false);
  // The machine prompt must name the approval blocker, not show "(none)" while saying "not safe".
  const p = renderNextAiPrompt(h);
  assert.match(p, /REQUIRE HUMAN APPROVAL/);
  assert.match(p, /Step 1: awaiting human approval/);
});

test("a bare approval-only step (no claim/witness) is NOT marked safe to continue", () => {
  // Regression: the approval label must reach the handoff even when the step has no claim or
  // witnessed call, or safe_to_continue would wrongly come back true.
  const h = buildWitnessedHandoff({
    objective: "Wait for the owner to approve the wire transfer.",
    steps: [{ needs_human_approval: true }]
  });
  assert.deepEqual(h.needs_human_approval, [0]);
  assert.equal(h.safe_to_continue, false);
  assert.match(renderNextAiPrompt(h), /Step 1: awaiting human approval/);
});

test("an action/result mismatch on a user-facing step makes the run NOT safe to continue", () => {
  const h = buildWitnessedHandoff({
    objective: "Email the client the signed contract.",
    steps: [
      {
        // Agent says it SENT; witness only saw a draft created. Claimed user-facing work didn't happen.
        claimed: { system: "gmail", action: "send", result: "sent", user_facing: true },
        witnessed: { system: "gmail", action: "create_draft", result: "created", returned: true }
      }
    ]
  });
  assert.ok(h.steps[0].labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.ok(h.steps[0].labels.includes("UNSUPPORTED"));
  assert.ok(h.steps[0].labels.includes("DO_NOT_SEND"));
  assert.equal(h.safe_to_continue, false);
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

test("proof_refs are rendered into BOTH the human handoff and the next-agent prompt", () => {
  const h = buildWitnessedHandoff({
    objective: "x",
    steps: [{ claimed: { system: "google_drive", action: "create_file" }, witnessed: { system: "google_drive", action: "create_file", returned: true } }],
    proof_refs: { google_doc: "https://docs.google.com/document/d/REAL/edit", result_hash: "sha256:c8f3f039022f9551" }
  });
  const md = renderHandoffMarkdown(h);
  const prompt = renderNextAiPrompt(h);
  assert.match(md, /## Proof \/ References/);
  assert.match(md, /google_doc: https:\/\/docs\.google\.com\/document\/d\/REAL\/edit/);
  assert.match(prompt, /carry these forward/);
  assert.match(prompt, /result_hash: sha256:c8f3f039022f9551/);
});

test("a handoff with proof_refs: null renders NO proof section (no drift for existing demos)", () => {
  const h = buildWitnessedHandoff({ objective: "x", steps: [], proof_refs: null });
  assert.doesNotMatch(renderHandoffMarkdown(h), /Proof \/ References/);
  assert.doesNotMatch(renderNextAiPrompt(h), /carry these forward/);
});
