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

test("labels are deduplicated and the result shape is stable", () => {
  const r = computeStepLabels({ index: 3, claimed: null, witnessed: null });
  assert.equal(r.index, 3);
  assert.equal(new Set(r.labels).size, r.labels.length);
  assert.ok(typeof r.human_note === "string");
});
