import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveWitnessedAction,
  witnessedFromEvent,
  runFromWitnessedEvents
} from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff } from "../src/generate.mjs";

test("resolveWitnessedAction cracks a Zapier wrapper call into its true app.action", () => {
  const r = resolveWitnessedAction({
    toolName: "execute_zapier_google_docs_action",
    arguments: JSON.stringify({ app: "Google Docs", action: "Create Document" })
  });
  assert.deepEqual(r, {
    system: "zapier",
    app: "google_docs", // normalized: lowercased, spaces → _
    action: "create_document",
    wrapper_family: "zapier"
  });
});

test("resolveWitnessedAction splits a non-wrapper tool into system + action (no hidden route)", () => {
  assert.deepEqual(resolveWitnessedAction({ toolName: "gmail.send", arguments: {} }), {
    system: "gmail",
    app: null,
    action: "send",
    wrapper_family: null
  });
  // MCP server__tool convention, mcp__ prefix stripped.
  assert.deepEqual(resolveWitnessedAction({ toolName: "mcp__Gmail__create_draft" }), {
    system: "gmail",
    app: null,
    action: "create_draft",
    wrapper_family: null
  });
  // A flat name with no separator is its own system, no derivable action.
  assert.deepEqual(resolveWitnessedAction({ toolName: "create_document" }), {
    system: "create_document",
    app: null,
    action: null,
    wrapper_family: null
  });
});

test("resolveWitnessedAction handles Apify call-actor (plain-object args, no sub-action)", () => {
  const r = resolveWitnessedAction({ toolName: "call-actor", arguments: { actor: "apify/web-scraper" } });
  assert.deepEqual(r, { system: "apify", app: "apify_web-scraper", action: null, wrapper_family: "apify" });
});

test("a wrapper call whose args do not disclose the operation still reveals the wrapper route", () => {
  const r = resolveWitnessedAction({ toolName: "execute_zapier_google_docs_action", arguments: "not json" });
  assert.deepEqual(r, { system: "zapier", app: null, action: null, wrapper_family: "zapier" });
});

test("witnessedFromEvent: APPROVED + returned carries the result hash and is not blocked", () => {
  const { witnessed, needs_human_approval } = witnessedFromEvent({
    call: { toolName: "execute_zapier_google_docs_action", arguments: JSON.stringify({ app: "google_docs", action: "create_document" }) },
    verdict: { kind: "APPROVED" },
    runtime_report: { returned: true, result_hash: "sha256:abc" }
  });
  assert.equal(witnessed.system, "zapier");
  assert.equal(witnessed.app, "google_docs");
  assert.equal(witnessed.returned, true);
  // On success the witness does NOT fabricate a semantic result — only returned + the hash.
  assert.equal(witnessed.result, undefined);
  assert.equal(witnessed.result_hash, "sha256:abc");
  assert.equal(needs_human_approval, false);
});

test("witnessedFromEvent: REFUSED verdict → not returned, result 'refused'", () => {
  const { witnessed } = witnessedFromEvent({
    call: { toolName: "gmail.send" },
    verdict: { kind: "REFUSED" }
  });
  assert.equal(witnessed.returned, false);
  assert.equal(witnessed.result, "refused");
});

test("witnessedFromEvent: ESCALATED verdict → needs human approval, not returned", () => {
  const { witnessed, needs_human_approval } = witnessedFromEvent({
    call: { toolName: "stripe.refund" },
    verdict: { kind: "ESCALATED" }
  });
  assert.equal(needs_human_approval, true);
  assert.equal(witnessed.returned, false);
  assert.equal(witnessed.result, "escalated");
});

test("witnessedFromEvent: an error_hash on the runtime report → result 'error'", () => {
  const { witnessed } = witnessedFromEvent({
    call: { toolName: "gmail.send" },
    verdict: { kind: "APPROVED" },
    runtime_report: { returned: false, error_hash: "sha256:err" }
  });
  assert.equal(witnessed.result, "error");
  assert.equal(witnessed.returned, false);
  assert.equal(witnessed.error_hash, "sha256:err");
});

test("end to end: an approved wrapper call with UNREADABLE args does not read as safe", () => {
  // The witness saw a Zapier call return, but its args did not disclose the operation. A returned
  // call must not let a user-facing claim be marked safe when the app/action was never verified.
  const h = buildWitnessedHandoff(
    runFromWitnessedEvents({
      objective: "Create the doc in Google.",
      steps: [
        {
          claim: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
          event: {
            call: { toolName: "execute_zapier_google_docs_action", arguments: "<<not json>>" },
            verdict: { kind: "APPROVED" },
            runtime_report: { returned: true }
          }
        }
      ]
    })
  );
  assert.ok(h.steps[0].labels.includes("NEEDS_EVIDENCE"));
  assert.ok(h.steps[0].labels.includes("UNSUPPORTED"));
  assert.equal(h.safe_to_continue, false);
});

test("end to end: the Hermes catch reproduced from REAL proxy-shaped events", () => {
  // Same story as the hand-mocked demo, but the witnessed side is now derived from a wrapper tool
  // call + judgment verdict + runtime report — the proxy's actual event vocabulary.
  const run = runFromWitnessedEvents({
    objective: "Create the onboarding doc in Google, share it, and confirm by email.",
    steps: [
      {
        // Agent SAYS it used Google Docs directly; witness saw the Zapier wrapper.
        claim: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
        event: {
          call: {
            toolName: "execute_zapier_google_docs_action",
            arguments: JSON.stringify({ app: "google_docs", action: "create_document" })
          },
          verdict: { kind: "APPROVED" },
          runtime_report: { returned: true, result_hash: "sha256:doc" }
        }
      },
      {
        // Agent SAYS it shared the doc; the witness saw no tool call at all.
        claim: { system: "google_drive", action: "share_with_client", result: "shared", user_facing: true },
        event: null
      },
      {
        // Clean: claim and witness agree.
        claim: { system: "gmail", action: "send_confirmation", result: "sent", user_facing: true },
        event: {
          call: { toolName: "gmail.send_confirmation" },
          verdict: { kind: "APPROVED" },
          runtime_report: { returned: true }
        }
      }
    ]
  });

  const h = buildWitnessedHandoff(run);
  assert.ok(h.steps[0].labels.includes("CLAIMED_ACTUAL_MISMATCH")); // said Google, witness saw Zapier
  assert.ok(h.steps[1].labels.includes("UNSUPPORTED")); // claimed but never witnessed
  assert.ok(h.steps[1].labels.includes("DO_NOT_SEND"));
  assert.deepEqual(h.steps[2].labels, ["SUPPORTED"]);
  assert.equal(h.safe_to_continue, false);
  assert.ok(h.systems_touched.includes("zapier"));
  assert.ok(h.systems_touched.includes("google_docs"));
});
