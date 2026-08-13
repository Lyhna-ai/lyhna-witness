import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  acknowledgeReview,
  deliverReviewReport,
  initializeReviewStore,
  loadReviewState,
  publishReviewReport,
  readReviewReport,
  recordReviewFinding,
  startReview,
  writeReviewCheckpoint
} from "../src/review-continuity.mjs";

const SUBJECT = Object.freeze({
  repository: "Lyhna-ai/lyhna-witness",
  head: "7e0df866540116d53f15cebe82e1f48bc96e62e2",
  scope: "pull_request_diff",
  base: "6e7a436b4abbaf3c025e47ff3b99b9bb6250aa4f"
});

function freshStore() {
  const root = mkdtempSync(join(tmpdir(), "lyhna-review-continuity-"));
  initializeReviewStore(root);
  return root;
}

function seedReview(root) {
  startReview(root, { event_ref: "event-start", review_ref: "review-1", subject: SUBJECT });
  return recordReviewFinding(root, {
    event_ref: "event-finding-1",
    review_ref: "review-1",
    subject: SUBJECT,
    evidence_ref: "relay-receipt-1",
    finding: {
      reviewer_ref: "claude-review-relay",
      severity: "P2",
      title: "Bind acknowledgements to the verified read",
      body: "A skipped or failed report read must not create acknowledgement.",
      path: "SPEC.md",
      line: 77
    }
  });
}

function publishAndDeliver(root) {
  publishReviewReport(root, {
    event_ref: "event-publish",
    review_ref: "review-1",
    subject: SUBJECT,
    report_ref: "report-1",
    markdown: "# Review report\n\nOne attributed finding.\n"
  });
  deliverReviewReport(root, {
    event_ref: "event-deliver",
    review_ref: "review-1",
    subject: SUBJECT,
    report_ref: "report-1",
    delivery_ref: "delivery-1",
    audience_ref: "agent-builder"
  });
}

test("one exact-head finding survives a checkpoint and restart", () => {
  const root = freshStore();
  const first = seedReview(root);
  assert.match(first.finding_ref, /^finding-[0-9a-f]{64}$/);
  writeReviewCheckpoint(root, { checkpoint_ref: "checkpoint-1" });

  const restarted = loadReviewState(root, { checkpoint_ref: "checkpoint-1" });
  assert.equal(restarted.reviews["review-1"].subject.head, SUBJECT.head);
  assert.equal(restarted.reviews["review-1"].inline_findings.length, 1);
  assert.equal(restarted.reviews["review-1"].inline_findings[0].finding_ref, first.finding_ref);
  assert.equal(restarted.reviews["review-1"].inline_findings[0].reviewer_ref, "claude-review-relay");
});

test("repeated evidence does not create duplicate inline findings across restart", () => {
  const root = freshStore();
  const first = seedReview(root);
  writeReviewCheckpoint(root, { checkpoint_ref: "checkpoint-1" });

  const replay = recordReviewFinding(root, {
    event_ref: "event-finding-replay",
    review_ref: "review-1",
    subject: SUBJECT,
    evidence_ref: "relay-receipt-1",
    finding: first.finding
  });
  assert.equal(replay.duplicate, true);

  const secondEvidence = recordReviewFinding(root, {
    event_ref: "event-finding-2",
    review_ref: "review-1",
    subject: SUBJECT,
    evidence_ref: "github-review-2",
    finding: first.finding
  });
  assert.equal(secondEvidence.duplicate, true);

  const restarted = loadReviewState(root, { checkpoint_ref: "checkpoint-1" });
  const findings = restarted.reviews["review-1"].inline_findings;
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].evidence_refs, ["relay-receipt-1", "github-review-2"]);
});

test("missing or altered report bytes cannot be read or acknowledged", () => {
  const root = freshStore();
  seedReview(root);
  publishAndDeliver(root);

  const reportPath = join(root, "reports", "report-1", "REPORT.md");
  writeFileSync(reportPath, "# Altered after publication\n");

  assert.throws(
    () =>
      readReviewReport(root, {
        read_ref: "read-failed",
        review_ref: "review-1",
        subject: SUBJECT,
        report_ref: "report-1",
        delivery_ref: "delivery-1",
        audience_ref: "agent-builder"
      }),
    /REPORT\.md digest mismatch/
  );
  assert.equal(existsSync(join(root, "events", "000000000005-read-failed.json")), false);
  assert.throws(
    () =>
      acknowledgeReview(root, {
        event_ref: "event-ack",
        review_ref: "review-1",
        subject: SUBJECT,
        report_ref: "report-1",
        delivery_ref: "delivery-1",
        audience_ref: "agent-builder",
        verified_read_ref: "read-failed"
      }),
    /successful verified read/
  );
  assert.equal(loadReviewState(root).reviews["review-1"].acknowledgement, null);
});

test("acknowledgement binds to a successful matching verified read and survives restart", () => {
  const root = freshStore();
  seedReview(root);
  publishAndDeliver(root);

  const read = readReviewReport(root, {
    read_ref: "read-1",
    review_ref: "review-1",
    subject: SUBJECT,
    report_ref: "report-1",
    delivery_ref: "delivery-1",
    audience_ref: "agent-builder"
  });
  assert.equal(read.markdown, "# Review report\n\nOne attributed finding.\n");
  assert.equal(read.verified_read.report_ref, "report-1");

  acknowledgeReview(root, {
    event_ref: "event-ack",
    review_ref: "review-1",
    subject: SUBJECT,
    report_ref: "report-1",
    delivery_ref: "delivery-1",
    audience_ref: "agent-builder",
    verified_read_ref: "read-1"
  });
  writeReviewCheckpoint(root, { checkpoint_ref: "checkpoint-ack" });

  const restarted = loadReviewState(root, { checkpoint_ref: "checkpoint-ack" });
  assert.equal(restarted.reviews["review-1"].acknowledgement.verified_read_ref, "read-1");
  assert.equal(restarted.reviews["review-1"].acknowledgement.audience_ref, "agent-builder");
});

test("an exact-head read cannot acknowledge a different reviewed head", () => {
  const root = freshStore();
  seedReview(root);
  publishAndDeliver(root);
  readReviewReport(root, {
    read_ref: "read-1",
    review_ref: "review-1",
    subject: SUBJECT,
    report_ref: "report-1",
    delivery_ref: "delivery-1",
    audience_ref: "agent-builder"
  });

  const otherSubject = { ...SUBJECT, head: "81cff5d46009613ad5a9a3f1d42ec2971864c8ef" };
  assert.throws(
    () =>
      acknowledgeReview(root, {
        event_ref: "event-cross-head-ack",
        review_ref: "review-1",
        subject: otherSubject,
        report_ref: "report-1",
        delivery_ref: "delivery-1",
        audience_ref: "agent-builder",
        verified_read_ref: "read-1"
      }),
    /subject does not match/
  );
});

test("checkpoint bytes and folded state are deterministic", () => {
  const root = freshStore();
  seedReview(root);
  const first = writeReviewCheckpoint(root, { checkpoint_ref: "checkpoint-1" });
  const bytes = readFileSync(first.path, "utf8");
  const reloaded = loadReviewState(root, { checkpoint_ref: "checkpoint-1" });
  assert.equal(JSON.stringify(reloaded), JSON.stringify(loadReviewState(root)));
  assert.equal(readFileSync(first.path, "utf8"), bytes);
});

test("a self-consistent checkpoint cannot replace the event-prefix fold", () => {
  const root = freshStore();
  seedReview(root);
  const written = writeReviewCheckpoint(root, { checkpoint_ref: "checkpoint-1" });
  const checkpoint = JSON.parse(readFileSync(written.path, "utf8"));
  checkpoint.state.reviews["review-1"].inline_findings = [];
  const stateBytes = Buffer.from(`${JSON.stringify(checkpoint.state, null, 2)}\n`, "utf8");
  checkpoint.state_digest = `sha256:${createHash("sha256").update(stateBytes).digest("hex")}`;
  writeFileSync(written.path, `${JSON.stringify(checkpoint, null, 2)}\n`);

  assert.throws(
    () => loadReviewState(root, { checkpoint_ref: "checkpoint-1" }),
    /checkpoint folded state does not match its event prefix/
  );
});
