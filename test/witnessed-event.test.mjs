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

test("resolveWitnessedAction cracks a NAMESPACED wrapper call (mcp__zapier__execute_zapier_*)", () => {
  // The MCP client namespaces the wrapper tool; the crack-open must still fire.
  const r = resolveWitnessedAction({
    toolName: "mcp__zapier__execute_zapier_google_docs_action",
    arguments: JSON.stringify({ app: "google_docs", action: "create_document" })
  });
  assert.deepEqual(r, {
    system: "zapier",
    app: "google_docs",
    action: "create_document",
    wrapper_family: "zapier"
  });
});

test("a namespaced non-wrapper tool keeps its server as system (mcp__Google_Drive__create_file)", () => {
  const r = resolveWitnessedAction({ toolName: "mcp__Google_Drive__create_file" });
  assert.deepEqual(r, { system: "google_drive", app: null, action: "create_file", wrapper_family: null });
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

test("end to end: LIVE catch — one REAL Google call vouched for, fabricated outreach flagged", () => {
  // The shape demo:real builds from a real captured Google Drive call: a single genuinely-witnessed
  // action surrounded by claims that never crossed the wire. The witness must vouch for ONLY the real
  // one and block the rest — the core promise, exercised on real-traffic shapes.
  const run = runFromWitnessedEvents({
    objective: "Create the prospect tracker, email 5 prospects, log them in the CRM.",
    steps: [
      {
        // REAL: claim names exactly what the live tool call resolves to (google_drive.create_file).
        claim: { system: "google_drive", action: "create_file", result: "created the tracker", user_facing: true },
        event: {
          call: { toolName: "mcp__Google_Drive__create_file", arguments: JSON.stringify({ title: "x" }) },
          verdict: { kind: "APPROVED" },
          runtime_report: { returned: true, result_hash: "sha256:c8f3f039022f9551" }
        }
      },
      // FABRICATED: no gmail / CRM call was ever witnessed.
      { claim: { system: "gmail", action: "send", result: "emailed 5 prospects", user_facing: true }, event: null },
      { claim: { system: "salesforce", action: "create_records", result: "logged 5", user_facing: true }, event: null }
    ],
    proof_refs: { google_doc: "https://docs.google.com/document/d/REAL/edit", result_hash: "sha256:c8f3f039022f9551" }
  });

  const h = buildWitnessedHandoff(run);
  assert.deepEqual(h.steps[0].labels, ["SUPPORTED"]); // the one real action, vouched for
  for (const i of [1, 2]) {
    assert.ok(h.steps[i].labels.includes("UNSUPPORTED"));
    assert.ok(h.steps[i].labels.includes("DO_NOT_SEND"));
  }
  assert.equal(h.safe_to_continue, false);
  // The witness only reports the system it actually saw — not the fabricated gmail / salesforce ones.
  assert.deepEqual(h.systems_touched, ["google_drive"]);
  assert.equal(h.proof_refs.result_hash, "sha256:c8f3f039022f9551");
});

test("end to end: UNIVERSAL catch — 'said sent, only drafted' on real Gmail traffic", () => {
  // The shape demo:gmail builds from two real mcp__Gmail__create_draft calls. Same witnessed action
  // both times (gmail.create_draft); only the CLAIM differs. The witness must catch the step that
  // calls a draft a send, and vouch for the step that honestly reports a draft.
  const draft = (hash) => ({
    call: { toolName: "mcp__Gmail__create_draft", arguments: JSON.stringify({ to: ["x@y.example"] }) },
    verdict: { kind: "APPROVED" },
    runtime_report: { returned: true, result_hash: hash }
  });
  const run = runFromWitnessedEvents({
    objective: "Send the follow-up; prepare the cover note.",
    steps: [
      { claim: { system: "gmail", action: "send", result: "sent the follow-up", user_facing: true }, event: draft("sha256:2879154e8e065626") },
      { claim: { system: "gmail", action: "create_draft", result: "saved a draft for review", user_facing: true }, event: draft("sha256:1c0972132e7344f3") }
    ]
  });
  const h = buildWitnessedHandoff(run);
  // Step 1: claimed a send, witness saw a draft → mismatch + unsupported + do-not-send.
  assert.ok(h.steps[0].labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.ok(h.steps[0].labels.includes("UNSUPPORTED"));
  assert.ok(h.steps[0].labels.includes("DO_NOT_SEND"));
  // Step 2: an honestly-reported draft is SUPPORTED — drafting itself is never the crime.
  assert.deepEqual(h.steps[1].labels, ["SUPPORTED"]);
  assert.equal(h.safe_to_continue, false);
  assert.deepEqual(h.systems_touched, ["gmail"]);
});
