import { test } from "node:test";
import assert from "node:assert/strict";

import { TRUST_LABELS as L, computeStepLabels } from "../src/labels.mjs";

test("claimed-but-not-witnessed → UNSUPPORTED + NEEDS_EVIDENCE (+ DO_NOT_SEND when user-facing)", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "google_drive", action: "share_with_client", result: "shared", user_facing: true },
    witnessed: null
  });
  assert.ok(r.labels.includes(L.UNSUPPORTED));
  assert.ok(r.labels.includes(L.NEEDS_EVIDENCE));
  assert.ok(r.labels.includes(L.DO_NOT_SEND));
  assert.ok(!r.labels.includes(L.SUPPORTED));
  assert.match(r.human_note, /no tool call/i);
});

test("undisclosed Zapier wrapper → CLAIMED_ACTUAL_MISMATCH even when the end app matches", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "google_docs", action: "create_document", result: "created" },
    witnessed: {
      system: "zapier",
      app: "google_docs",
      action: "create_document",
      result: "created",
      returned: true,
      wrapper_family: "zapier"
    }
  });
  assert.ok(r.labels.includes(L.CLAIMED_ACTUAL_MISMATCH));
  assert.ok(!r.labels.includes(L.SUPPORTED));
  assert.match(r.human_note, /zapier/i);
});

test("differing system → CLAIMED_ACTUAL_MISMATCH", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "google_docs", action: "create_document", result: "created" },
    witnessed: { system: "notion", action: "create_page", result: "created", returned: true }
  });
  assert.ok(r.labels.includes(L.CLAIMED_ACTUAL_MISMATCH));
});

test("same system but different action/result → CLAIMED_ACTUAL_MISMATCH, never SUPPORTED", () => {
  // The agent says it SENT the email; the witness only saw it create a DRAFT. Same system (gmail),
  // no wrapper, the call succeeded — but it is NOT the work the agent claimed.
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "gmail", action: "send", result: "sent", user_facing: true },
    witnessed: { system: "gmail", action: "create_draft", result: "created", returned: true }
  });
  assert.ok(r.labels.includes(L.CLAIMED_ACTUAL_MISMATCH));
  assert.ok(!r.labels.includes(L.SUPPORTED));
  // The claimed user-facing action did not happen, so it must also block (not just flag a route note).
  assert.ok(r.labels.includes(L.UNSUPPORTED));
  assert.ok(r.labels.includes(L.DO_NOT_SEND));
  assert.match(r.human_note, /create_draft/);
});

test("differing result alone (same action) → CLAIMED_ACTUAL_MISMATCH + UNSUPPORTED", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "stripe", action: "refund", result: "refunded" },
    witnessed: { system: "stripe", action: "refund", result: "pending", returned: true }
  });
  assert.ok(r.labels.includes(L.CLAIMED_ACTUAL_MISMATCH));
  assert.ok(r.labels.includes(L.UNSUPPORTED));
  assert.ok(!r.labels.includes(L.DO_NOT_SEND)); // not user-facing
  assert.ok(!r.labels.includes(L.SUPPORTED));
});

test("route-only mismatch (same action/result via another path) is NOT marked UNSUPPORTED", () => {
  // Claimed Google directly; witness saw the same create_document/created routed through Zapier.
  // The route differed, but the work happened — flag it, do not block it.
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
    witnessed: {
      system: "zapier",
      app: "google_docs",
      action: "create_document",
      result: "created",
      returned: true,
      wrapper_family: "zapier"
    }
  });
  assert.ok(r.labels.includes(L.CLAIMED_ACTUAL_MISMATCH));
  assert.ok(!r.labels.includes(L.UNSUPPORTED));
  assert.ok(!r.labels.includes(L.DO_NOT_SEND));
});

test("wrapper route seen but operation UNREADABLE → NEEDS_EVIDENCE + UNSUPPORTED, never SUPPORTED", () => {
  // The witness saw a Zapier call return, but could not read which app/action — so a claim that a
  // specific thing happened is unverified, even though the call returned.
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "google_docs", action: "create_document", result: "created", user_facing: true },
    witnessed: { system: "zapier", wrapper_family: "zapier", returned: true }
  });
  assert.ok(r.labels.includes(L.NEEDS_EVIDENCE));
  assert.ok(r.labels.includes(L.UNSUPPORTED));
  assert.ok(r.labels.includes(L.DO_NOT_SEND));
  assert.ok(!r.labels.includes(L.SUPPORTED));
});

test("witnessed failure → UNSUPPORTED (+ DO_NOT_SEND when user-facing)", () => {
  const r = computeStepLabels({
    index: 0,
    user_facing: true,
    claimed: { system: "gmail", action: "send", result: "sent" },
    witnessed: { system: "gmail", action: "send", result: "error", returned: false }
  });
  assert.ok(r.labels.includes(L.UNSUPPORTED));
  assert.ok(r.labels.includes(L.DO_NOT_SEND));
});

test("claimed agrees with witnessed → SUPPORTED", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "gmail", action: "send", result: "sent" },
    witnessed: { system: "gmail", action: "send", result: "sent", returned: true }
  });
  assert.deepEqual(r.labels, [L.SUPPORTED]);
});

test("matching app via the SAME declared wrapper is not a mismatch", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "google_docs", via: "zapier", action: "create_document", result: "created" },
    witnessed: {
      system: "zapier",
      app: "google_docs",
      action: "create_document",
      result: "created",
      returned: true,
      wrapper_family: "zapier"
    }
  });
  // The agent disclosed the Zapier route, so it is not a path mismatch.
  assert.ok(!r.labels.includes(L.CLAIMED_ACTUAL_MISMATCH));
});

test("needs_human_approval routes to a person, never auto-decided", () => {
  const r = computeStepLabels({
    index: 0,
    needs_human_approval: true,
    claimed: { system: "stripe", action: "refund", result: "refunded" },
    witnessed: { system: "stripe", action: "refund", result: "refunded", returned: true }
  });
  assert.ok(r.labels.includes(L.NEEDS_HUMAN_APPROVAL));
});

test("NEEDS_HUMAN_APPROVAL survives every early-return path (even a bare approval-only step)", () => {
  // No claim, no witnessed call — just an approval gate. The label must still be applied.
  const r = computeStepLabels({ index: 0, needs_human_approval: true });
  assert.ok(r.labels.includes(L.NEEDS_HUMAN_APPROVAL));
});

test("labels are deduplicated and the result shape is stable", () => {
  const r = computeStepLabels({ index: 3, claimed: null, witnessed: null });
  assert.equal(r.index, 3);
  assert.equal(new Set(r.labels).size, r.labels.length);
  assert.ok(typeof r.human_note === "string");
});

test("no-claim observation: SUPPORTED only when it succeeded, UNSUPPORTED when it failed", () => {
  // A witnessed call the agent never claimed, that returned successfully → observed/supported.
  const ok = computeStepLabels({ claimed: null, witnessed: { system: "gmail", action: "send", returned: true } });
  assert.deepEqual(ok.labels, [L.SUPPORTED]);

  // The same with no successful return (e.g. a REFUSED/failed call) must NOT read as supported work.
  const failed = computeStepLabels({ claimed: null, witnessed: { system: "gmail", action: "send", returned: false } });
  assert.ok(failed.labels.includes(L.UNSUPPORTED));
  assert.ok(!failed.labels.includes(L.SUPPORTED));

  const refused = computeStepLabels({ claimed: null, witnessed: { system: "gmail", returned: false, result: "refused" } });
  assert.ok(refused.labels.includes(L.UNSUPPORTED));
  assert.ok(!refused.labels.includes(L.SUPPORTED));
});

test("a blocked call (refused/escalated) is NOT narrated as having run — it never executed", () => {
  // REFUSED and ESCALATED are blocked BEFORE execution; the tool never runs. The note must not claim
  // it "ran", which would assert an execution the witness did not observe (an honesty-ceiling breach).
  const refused = computeStepLabels({
    claimed: { system: "gmail", action: "send", result: "sent the invoice", user_facing: true },
    witnessed: { system: "gmail", action: "send", returned: false, result: "refused" }
  });
  assert.ok(refused.labels.includes(L.UNSUPPORTED));
  assert.ok(refused.labels.includes(L.DO_NOT_SEND));
  assert.match(refused.human_note, /blocked before it ran|did not execute/);
  assert.doesNotMatch(refused.human_note, /the tool call ran/i);

  const escalated = computeStepLabels({
    claimed: { system: "payments", action: "refund", user_facing: true },
    witnessed: { system: "payments", action: "refund", returned: false, result: "escalated" },
    needs_human_approval: true
  });
  assert.ok(escalated.labels.includes(L.NEEDS_HUMAN_APPROVAL));
  assert.ok(escalated.labels.includes(L.UNSUPPORTED));
  assert.match(escalated.human_note, /escalated for human approval|did not execute/);
  assert.doesNotMatch(escalated.human_note, /the tool call ran/i);

  // A genuine runtime error (APPROVED + upstream failure) DID run — that wording stays accurate.
  const errored = computeStepLabels({
    claimed: null,
    witnessed: { system: "filesystem", action: "write_file", returned: false, result: "error" }
  });
  assert.match(errored.human_note, /did not succeed/);
});

// REGRESSION (P1 fail-open found by the breaker panel): the agent named a specific ACTION the witness
// could not corroborate (flat/opaque tool name → no derivable witnessed action). A bare returned call
// must NOT read as SUPPORTED — it is evidence the call ran, not that the claimed action happened.
test("claimed action the witness can't corroborate (flat tool name) → NOT supported, fail-closed", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "gmail", action: "send", result: "contract emailed to client", user_facing: true },
    witnessed: { system: "gmail", returned: true } // flat 'gmail' → no witnessed action
  });
  assert.ok(!r.labels.includes(L.SUPPORTED), "an uncorroborated claimed action must not be SUPPORTED");
  assert.ok(r.labels.includes(L.UNSUPPORTED));
  assert.ok(r.labels.includes(L.NEEDS_EVIDENCE));
  assert.ok(r.labels.includes(L.DO_NOT_SEND), "a user-facing uncorroborated action must block send");
  assert.match(r.human_note, /without being able to confirm it performed that action/i);
});

test("a corroborated action (witnessed action present and equal) still reads SUPPORTED", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "filesystem", action: "write_file", result: "wrote the file" },
    witnessed: { system: "filesystem", action: "write_file", returned: true }
  });
  assert.ok(r.labels.includes(L.SUPPORTED));
  assert.ok(!r.labels.includes(L.UNSUPPORTED));
});

test("action-axis only: a claim with NO action on a flat tool stays SUPPORTED (result axis not used)", () => {
  // Per the owner-approved scope, a claimed RESULT with no witnessed result does NOT flag — a successful
  // call never carries a witnessed result, so using the result axis would flag every legitimate step.
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "filesystem", result: "did the thing" },
    witnessed: { system: "filesystem", returned: true }
  });
  assert.ok(r.labels.includes(L.SUPPORTED));
});

// REGRESSION (Codex P2 on #37): a wrapper that resolves an APP but no sub-action (Apify `call-actor`)
// corroborates the operation at the boundary — the action-axis guard must NOT flag it unsafe.
test("wrapper with resolved app but no sub-action (Apify call-actor) stays SUPPORTED", () => {
  const r = computeStepLabels({
    index: 0,
    claimed: { system: "apify_web-scraper", via: "apify", action: "call_actor" },
    witnessed: { system: "apify", app: "apify_web-scraper", action: null, returned: true, wrapper_family: "apify" }
  });
  assert.ok(r.labels.includes(L.SUPPORTED), "an app-corroborated wrapper call must stay supported");
  assert.ok(!r.labels.includes(L.UNSUPPORTED));
});
