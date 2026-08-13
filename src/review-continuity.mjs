// Lyhna Review Continuity Slice 2.
//
// This module records attributed review evidence. It does not run reviewers or decide whether work is
// correct. Its filesystem protocol is deterministic: caller-supplied identities, exclusive writes,
// stable event order, no clock, no randomness, and no model calls.

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";

export const REVIEW_EVENT_SCHEMA = "lyhna-review-event/v1";
export const REVIEW_STATE_SCHEMA = "lyhna-review-state/v1";
export const REVIEW_CHECKPOINT_SCHEMA = "lyhna-review-checkpoint/v1";
export const REVIEW_REPORT_RESOURCE_SCHEMA = "lyhna-review-report-resource/v1";

const EVENT_KINDS = new Set([
  "review_started",
  "finding_observed",
  "report_published",
  "report_delivered",
  "report_read_verified",
  "review_acknowledged"
]);
const REVIEW_SCOPES = new Set(["whole_commit", "pull_request_diff"]);
const SEVERITIES = new Set(["P0", "P1", "P2", "P3"]);
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertRef(name, value) {
  if (typeof value !== "string" || !REF_PATTERN.test(value)) {
    throw new TypeError(`${name} must match ${REF_PATTERN}`);
  }
  return value;
}

function assertDigest(name, value) {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${name} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function normalizeSubject(subject) {
  assertObject("subject", subject);
  if (typeof subject.repository !== "string" || !REPOSITORY_PATTERN.test(subject.repository)) {
    throw new TypeError("subject.repository must be owner/repository");
  }
  if (typeof subject.head !== "string" || !SHA_PATTERN.test(subject.head)) {
    throw new TypeError("subject.head must be an exact 40-character lowercase commit SHA");
  }
  if (!REVIEW_SCOPES.has(subject.scope)) {
    throw new TypeError("subject.scope must be whole_commit or pull_request_diff");
  }
  if (!Object.hasOwn(subject, "base")) {
    throw new TypeError("subject.base must be explicit");
  }
  if (subject.scope === "pull_request_diff") {
    if (typeof subject.base !== "string" || !SHA_PATTERN.test(subject.base)) {
      throw new TypeError("pull_request_diff subject.base must be an exact commit SHA");
    }
  } else if (subject.base !== null) {
    throw new TypeError("whole_commit subject.base must be null");
  }
  return {
    repository: subject.repository,
    head: subject.head,
    scope: subject.scope,
    base: subject.base
  };
}

function subjectKey(subject) {
  return JSON.stringify(normalizeSubject(subject));
}

function normalizeFinding(finding) {
  assertObject("finding", finding);
  const reviewerRef = assertRef("finding.reviewer_ref", finding.reviewer_ref);
  if (!SEVERITIES.has(finding.severity)) {
    throw new TypeError("finding.severity must be P0, P1, P2, or P3");
  }
  if (typeof finding.title !== "string" || finding.title.trim().length === 0) {
    throw new TypeError("finding.title must be non-empty");
  }
  if (typeof finding.body !== "string" || finding.body.trim().length === 0) {
    throw new TypeError("finding.body must be non-empty");
  }
  const findingPath = finding.path ?? null;
  if (
    findingPath !== null &&
    (typeof findingPath !== "string" ||
      findingPath.length === 0 ||
      findingPath.startsWith("/") ||
      findingPath.includes("\\") ||
      findingPath.split("/").some((part) => part === "" || part === "." || part === ".."))
  ) {
    throw new TypeError("finding.path must be a normalized repository-relative path or null");
  }
  const line = finding.line ?? null;
  if (line !== null && (!Number.isSafeInteger(line) || line < 1)) {
    throw new TypeError("finding.line must be a positive integer or null");
  }
  return {
    severity: finding.severity,
    reviewer_ref: reviewerRef,
    title: finding.title,
    body: finding.body,
    path: findingPath,
    line
  };
}

export function computeFindingRef(subject, finding) {
  const identity = {
    subject: normalizeSubject(subject),
    finding: normalizeFinding(finding)
  };
  return `finding-${createHash("sha256").update(JSON.stringify(identity), "utf8").digest("hex")}`;
}

function emptyState() {
  return {
    schema: REVIEW_STATE_SCHEMA,
    through_sequence: 0,
    reviews: {}
  };
}

function assertState(state) {
  assertObject("state", state);
  if (state.schema !== REVIEW_STATE_SCHEMA) {
    throw new Error(`unsupported review state schema: ${String(state.schema)}`);
  }
  if (!Number.isSafeInteger(state.through_sequence) || state.through_sequence < 0) {
    throw new Error("review state has invalid through_sequence");
  }
  assertObject("state.reviews", state.reviews);
}

function assertEventEnvelope(event, expectedSequence) {
  assertObject("event", event);
  if (event.schema !== REVIEW_EVENT_SCHEMA) {
    throw new Error(`unsupported review event schema: ${String(event.schema)}`);
  }
  assertRef("event.event_ref", event.event_ref);
  if (event.sequence !== expectedSequence) {
    throw new Error(`review event sequence must be ${expectedSequence}, got ${String(event.sequence)}`);
  }
  if (!EVENT_KINDS.has(event.kind)) {
    throw new Error(`unsupported review event kind: ${String(event.kind)}`);
  }
  assertRef("event.review_ref", event.review_ref);
  normalizeSubject(event.subject);
  assertObject("event.payload", event.payload);
}

function requireReview(state, reviewRef, subject, operation) {
  if (!Object.hasOwn(state.reviews, reviewRef)) {
    throw new Error(`${operation}: review ${reviewRef} does not exist`);
  }
  const review = state.reviews[reviewRef];
  if (review.subject_key !== subjectKey(subject)) {
    throw new Error(`${operation}: subject does not match review ${reviewRef}`);
  }
  return review;
}

function sameArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function applyEvent(state, event) {
  assertState(state);
  assertEventEnvelope(event, state.through_sequence + 1);
  const subject = normalizeSubject(event.subject);

  if (event.kind === "review_started") {
    if (Object.hasOwn(state.reviews, event.review_ref)) {
      throw new Error(`review_started: review ${event.review_ref} already exists`);
    }
    state.reviews[event.review_ref] = {
      subject,
      subject_key: subjectKey(subject),
      inline_findings: [],
      report: null,
      deliveries: [],
      verified_reads: [],
      acknowledgement: null
    };
  } else if (event.kind === "finding_observed") {
    const review = requireReview(state, event.review_ref, subject, "finding_observed");
    if (review.report) {
      throw new Error("finding_observed: review findings are frozen after report publication");
    }
    const finding = normalizeFinding(event.payload.finding);
    const findingRef = computeFindingRef(subject, finding);
    if (event.payload.finding_ref !== findingRef) {
      throw new Error("finding_observed: finding_ref does not match the canonical finding");
    }
    const evidenceRef = assertRef("finding_observed.evidence_ref", event.payload.evidence_ref);
    let current = review.inline_findings.find((item) => item.finding_ref === findingRef);
    if (!current) {
      current = {
        finding_ref: findingRef,
        reviewed_head: subject.head,
        ...finding,
        evidence_refs: []
      };
      review.inline_findings.push(current);
    } else {
      const comparable = {
        severity: current.severity,
        reviewer_ref: current.reviewer_ref,
        title: current.title,
        body: current.body,
        path: current.path,
        line: current.line
      };
      if (JSON.stringify(comparable) !== JSON.stringify(finding)) {
        throw new Error("finding_observed: finding identity collision");
      }
    }
    if (!current.evidence_refs.includes(evidenceRef)) current.evidence_refs.push(evidenceRef);
  } else if (event.kind === "report_published") {
    const review = requireReview(state, event.review_ref, subject, "report_published");
    if (review.report) throw new Error("report_published: review already has a report");
    const findingRefs = event.payload.finding_refs;
    if (!Array.isArray(findingRefs)) throw new TypeError("report_published.finding_refs must be an array");
    const expected = review.inline_findings.map((finding) => finding.finding_ref);
    if (!sameArray(findingRefs, expected)) {
      throw new Error("report_published: finding_refs do not match the folded findings");
    }
    review.report = {
      report_ref: assertRef("report_published.report_ref", event.payload.report_ref),
      markdown_digest: assertDigest("report_published.markdown_digest", event.payload.markdown_digest),
      finding_refs: [...findingRefs]
    };
  } else if (event.kind === "report_delivered") {
    const review = requireReview(state, event.review_ref, subject, "report_delivered");
    if (!review.report || review.report.report_ref !== event.payload.report_ref) {
      throw new Error("report_delivered: published report not found");
    }
    if (review.report.markdown_digest !== event.payload.markdown_digest) {
      throw new Error("report_delivered: report digest does not match");
    }
    const deliveryRef = assertRef("report_delivered.delivery_ref", event.payload.delivery_ref);
    if (review.deliveries.some((delivery) => delivery.delivery_ref === deliveryRef)) {
      throw new Error("report_delivered: delivery_ref already exists");
    }
    review.deliveries.push({
      delivery_ref: deliveryRef,
      report_ref: review.report.report_ref,
      audience_ref: assertRef("report_delivered.audience_ref", event.payload.audience_ref),
      markdown_digest: review.report.markdown_digest
    });
  } else if (event.kind === "report_read_verified") {
    const review = requireReview(state, event.review_ref, subject, "report_read_verified");
    const delivery = review.deliveries.find(
      (candidate) => candidate.delivery_ref === event.payload.delivery_ref
    );
    if (
      !delivery ||
      delivery.report_ref !== event.payload.report_ref ||
      delivery.audience_ref !== event.payload.audience_ref ||
      delivery.markdown_digest !== event.payload.markdown_digest
    ) {
      throw new Error("report_read_verified: matching delivery not found");
    }
    const readRef = assertRef("report_read_verified.read_ref", event.payload.read_ref);
    if (review.verified_reads.some((read) => read.read_ref === readRef)) {
      throw new Error("report_read_verified: read_ref already exists");
    }
    review.verified_reads.push({
      read_ref: readRef,
      report_ref: delivery.report_ref,
      delivery_ref: delivery.delivery_ref,
      audience_ref: delivery.audience_ref,
      markdown_digest: delivery.markdown_digest
    });
  } else if (event.kind === "review_acknowledged") {
    const review = requireReview(state, event.review_ref, subject, "review_acknowledged");
    if (review.acknowledgement) {
      throw new Error("review_acknowledged: review already has an acknowledgement");
    }
    const read = review.verified_reads.find(
      (candidate) => candidate.read_ref === event.payload.verified_read_ref
    );
    if (
      !read ||
      read.report_ref !== event.payload.report_ref ||
      read.delivery_ref !== event.payload.delivery_ref ||
      read.audience_ref !== event.payload.audience_ref ||
      read.markdown_digest !== event.payload.markdown_digest
    ) {
      throw new Error("review_acknowledged: successful verified read not found");
    }
    review.acknowledgement = {
      report_ref: read.report_ref,
      delivery_ref: read.delivery_ref,
      audience_ref: read.audience_ref,
      verified_read_ref: read.read_ref,
      markdown_digest: read.markdown_digest
    };
  }

  state.through_sequence = event.sequence;
  return state;
}

export function foldReviewEvents(events, options = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  const state = options.initial_state ? clone(options.initial_state) : emptyState();
  assertState(state);
  for (const event of events) applyEvent(state, clone(event));
  return state;
}

function rootPaths(root) {
  if (typeof root !== "string" || root.length === 0) {
    throw new TypeError("review store root must be a non-empty path string");
  }
  return {
    root,
    events: join(root, "events"),
    reports: join(root, "reports"),
    checkpoints: join(root, "checkpoints")
  };
}

export function initializeReviewStore(root) {
  const paths = rootPaths(root);
  mkdirSync(paths.root, { recursive: true, mode: 0o700 });
  mkdirSync(paths.events, { recursive: true, mode: 0o700 });
  mkdirSync(paths.reports, { recursive: true, mode: 0o700 });
  mkdirSync(paths.checkpoints, { recursive: true, mode: 0o700 });
  return paths;
}

function writeExclusiveOrSame(path, bytes) {
  try {
    writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
    return false;
  } catch (error) {
    if (error && error.code === "EEXIST") {
      const current = readFileSync(path);
      if (Buffer.compare(current, bytes) === 0) return true;
      throw new Error(`existing file conflicts with deterministic bytes: ${path}`);
    }
    throw error;
  }
}

function readEvents(root) {
  const paths = initializeReviewStore(root);
  const names = readdirSync(paths.events)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const records = names.map((name, index) => {
    const expectedPrefix = String(index + 1).padStart(12, "0");
    if (!name.startsWith(`${expectedPrefix}-`)) {
      throw new Error(`review event file sequence gap at ${name}`);
    }
    const raw = readFileSync(join(paths.events, name));
    let event;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch (error) {
      throw new Error(`review event is not valid JSON at ${name}: ${error.message}`);
    }
    if (event.sequence !== index + 1) {
      throw new Error(`review event sequence does not match filename at ${name}`);
    }
    return { event, raw };
  });
  return { paths, records };
}

function chainDigest(records, throughSequence = records.length) {
  const hash = createHash("sha256");
  for (const { raw } of records.slice(0, throughSequence)) {
    hash.update(String(raw.length), "utf8");
    hash.update(":", "utf8");
    hash.update(raw);
  }
  return `sha256:${hash.digest("hex")}`;
}

function readCheckpoint(root, checkpointRef, records) {
  assertRef("checkpoint_ref", checkpointRef);
  const path = join(rootPaths(root).checkpoints, `${checkpointRef}.json`);
  let checkpoint;
  try {
    checkpoint = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot read checkpoint ${checkpointRef}: ${error.message}`);
  }
  assertObject("checkpoint", checkpoint);
  if (checkpoint.schema !== REVIEW_CHECKPOINT_SCHEMA) {
    throw new Error("unsupported review checkpoint schema");
  }
  if (checkpoint.checkpoint_ref !== checkpointRef) {
    throw new Error("checkpoint reference does not match its path");
  }
  if (
    !Number.isSafeInteger(checkpoint.through_sequence) ||
    checkpoint.through_sequence < 0 ||
    checkpoint.through_sequence > records.length
  ) {
    throw new Error("checkpoint has invalid event-prefix sequence");
  }
  if (checkpoint.event_chain_digest !== chainDigest(records, checkpoint.through_sequence)) {
    throw new Error("checkpoint event-prefix chain digest mismatch");
  }
  if (checkpoint.state_digest !== digestBytes(jsonBytes(checkpoint.state))) {
    throw new Error("checkpoint state digest mismatch");
  }
  assertState(checkpoint.state);
  if (checkpoint.state.through_sequence !== checkpoint.through_sequence) {
    throw new Error("checkpoint state sequence mismatch");
  }
  const foldedPrefix = foldReviewEvents(
    records.slice(0, checkpoint.through_sequence).map((record) => record.event)
  );
  if (checkpoint.state_digest !== digestBytes(jsonBytes(foldedPrefix))) {
    throw new Error("checkpoint folded state does not match its event prefix");
  }
  return checkpoint;
}

export function loadReviewState(root, options = {}) {
  const { records } = readEvents(root);
  if (options.checkpoint_ref) {
    const checkpoint = readCheckpoint(root, options.checkpoint_ref, records);
    return foldReviewEvents(
      records.slice(checkpoint.through_sequence).map((record) => record.event),
      { initial_state: checkpoint.state }
    );
  }
  return foldReviewEvents(records.map((record) => record.event));
}

function comparableEvent(event) {
  return {
    schema: event.schema,
    event_ref: event.event_ref,
    kind: event.kind,
    review_ref: event.review_ref,
    subject: event.subject,
    payload: event.payload
  };
}

function appendEvent(root, input) {
  const { paths, records } = readEvents(root);
  assertRef("event_ref", input.event_ref);
  const comparable = {
    schema: REVIEW_EVENT_SCHEMA,
    event_ref: input.event_ref,
    kind: input.kind,
    review_ref: input.review_ref,
    subject: normalizeSubject(input.subject),
    payload: input.payload
  };
  const prior = records.find((record) => record.event.event_ref === input.event_ref);
  if (prior) {
    if (JSON.stringify(comparableEvent(prior.event)) !== JSON.stringify(comparable)) {
      throw new Error(`event_ref ${input.event_ref} conflicts with stored event`);
    }
    return { event: prior.event, state: foldReviewEvents(records.map((record) => record.event)), replayed: true };
  }

  const event = {
    ...comparable,
    sequence: records.length + 1
  };
  const state = foldReviewEvents([event], {
    initial_state: foldReviewEvents(records.map((record) => record.event))
  });
  const name = `${String(event.sequence).padStart(12, "0")}-${event.event_ref}.json`;
  writeExclusiveOrSame(join(paths.events, name), jsonBytes(event));
  return { event, state, replayed: false };
}

function reviewForInput(root, reviewRef, subject, operation) {
  assertRef("review_ref", reviewRef);
  const state = loadReviewState(root);
  return {
    state,
    review: requireReview(state, reviewRef, subject, operation)
  };
}

export function startReview(root, input) {
  assertRef("review_ref", input.review_ref);
  return appendEvent(root, {
    event_ref: input.event_ref,
    kind: "review_started",
    review_ref: input.review_ref,
    subject: input.subject,
    payload: {}
  });
}

export function recordReviewFinding(root, input) {
  assertRef("evidence_ref", input.evidence_ref);
  const finding = normalizeFinding(input.finding);
  const findingRef = computeFindingRef(input.subject, finding);
  const { review } = reviewForInput(root, input.review_ref, input.subject, "recordReviewFinding");
  const existing = review.inline_findings.find((item) => item.finding_ref === findingRef);
  appendEvent(root, {
    event_ref: input.event_ref,
    kind: "finding_observed",
    review_ref: input.review_ref,
    subject: input.subject,
    payload: {
      finding_ref: findingRef,
      finding,
      evidence_ref: input.evidence_ref
    }
  });
  return {
    finding_ref: findingRef,
    finding,
    duplicate: Boolean(existing)
  };
}

function reportPaths(root, reportRef) {
  assertRef("report_ref", reportRef);
  const directory = join(rootPaths(root).reports, reportRef);
  return {
    directory,
    markdown: join(directory, "REPORT.md"),
    manifest: join(directory, "report.json")
  };
}

export function publishReviewReport(root, input) {
  if (typeof input.markdown !== "string") {
    throw new TypeError("publishReviewReport.markdown must be a string");
  }
  assertRef("report_ref", input.report_ref);
  const { review } = reviewForInput(root, input.review_ref, input.subject, "publishReviewReport");
  const markdownBytes = Buffer.from(input.markdown, "utf8");
  const manifest = {
    schema: REVIEW_REPORT_RESOURCE_SCHEMA,
    report_ref: input.report_ref,
    review_ref: input.review_ref,
    subject: normalizeSubject(input.subject),
    finding_refs: review.inline_findings.map((finding) => finding.finding_ref),
    markdown_digest: digestBytes(markdownBytes)
  };
  const paths = reportPaths(root, input.report_ref);
  mkdirSync(paths.directory, { recursive: true, mode: 0o700 });
  writeExclusiveOrSame(paths.markdown, markdownBytes);
  writeExclusiveOrSame(paths.manifest, jsonBytes(manifest));
  return appendEvent(root, {
    event_ref: input.event_ref,
    kind: "report_published",
    review_ref: input.review_ref,
    subject: input.subject,
    payload: {
      report_ref: manifest.report_ref,
      finding_refs: manifest.finding_refs,
      markdown_digest: manifest.markdown_digest
    }
  });
}

export function deliverReviewReport(root, input) {
  const { review } = reviewForInput(root, input.review_ref, input.subject, "deliverReviewReport");
  if (!review.report || review.report.report_ref !== input.report_ref) {
    throw new Error("deliverReviewReport: published report not found");
  }
  return appendEvent(root, {
    event_ref: input.event_ref,
    kind: "report_delivered",
    review_ref: input.review_ref,
    subject: input.subject,
    payload: {
      report_ref: input.report_ref,
      markdown_digest: review.report.markdown_digest,
      delivery_ref: input.delivery_ref,
      audience_ref: input.audience_ref
    }
  });
}

function readReportManifest(root, reportRef) {
  const paths = reportPaths(root, reportRef);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(paths.manifest, "utf8"));
  } catch (error) {
    throw new Error(`readReviewReport: cannot read report manifest: ${error.message}`);
  }
  if (manifest.schema !== REVIEW_REPORT_RESOURCE_SCHEMA) {
    throw new Error("readReviewReport: unsupported report resource schema");
  }
  return { paths, manifest };
}

export function readReviewReport(root, input) {
  assertRef("read_ref", input.read_ref);
  const { review } = reviewForInput(root, input.review_ref, input.subject, "readReviewReport");
  if (!review.report || review.report.report_ref !== input.report_ref) {
    throw new Error("readReviewReport: published report not found");
  }
  const delivery = review.deliveries.find(
    (candidate) =>
      candidate.delivery_ref === input.delivery_ref &&
      candidate.audience_ref === input.audience_ref &&
      candidate.report_ref === input.report_ref
  );
  if (!delivery) throw new Error("readReviewReport: matching delivery not found");

  const { paths, manifest } = readReportManifest(root, input.report_ref);
  if (
    manifest.report_ref !== input.report_ref ||
    manifest.review_ref !== input.review_ref ||
    subjectKey(manifest.subject) !== subjectKey(input.subject) ||
    manifest.markdown_digest !== review.report.markdown_digest ||
    !sameArray(manifest.finding_refs, review.report.finding_refs)
  ) {
    throw new Error("readReviewReport: report manifest does not match the folded review");
  }

  let markdownBytes;
  try {
    markdownBytes = readFileSync(paths.markdown);
  } catch (error) {
    throw new Error(`readReviewReport: cannot read REPORT.md: ${error.message}`);
  }
  const markdownDigest = digestBytes(markdownBytes);
  if (markdownDigest !== manifest.markdown_digest) {
    throw new Error("readReviewReport: REPORT.md digest mismatch");
  }

  const appended = appendEvent(root, {
    event_ref: input.read_ref,
    kind: "report_read_verified",
    review_ref: input.review_ref,
    subject: input.subject,
    payload: {
      read_ref: input.read_ref,
      report_ref: input.report_ref,
      delivery_ref: input.delivery_ref,
      audience_ref: input.audience_ref,
      markdown_digest: markdownDigest
    }
  });
  const verifiedRead = appended.state.reviews[input.review_ref].verified_reads.find(
    (read) => read.read_ref === input.read_ref
  );
  return {
    markdown: markdownBytes.toString("utf8"),
    verified_read: clone(verifiedRead),
    replayed: appended.replayed
  };
}

export function acknowledgeReview(root, input) {
  const { review } = reviewForInput(root, input.review_ref, input.subject, "acknowledgeReview");
  const read = review.verified_reads.find((candidate) => candidate.read_ref === input.verified_read_ref);
  if (
    !read ||
    read.report_ref !== input.report_ref ||
    read.delivery_ref !== input.delivery_ref ||
    read.audience_ref !== input.audience_ref
  ) {
    throw new Error("acknowledgeReview: successful verified read not found");
  }
  return appendEvent(root, {
    event_ref: input.event_ref,
    kind: "review_acknowledged",
    review_ref: input.review_ref,
    subject: input.subject,
    payload: {
      report_ref: read.report_ref,
      delivery_ref: read.delivery_ref,
      audience_ref: read.audience_ref,
      verified_read_ref: read.read_ref,
      markdown_digest: read.markdown_digest
    }
  });
}

export function writeReviewCheckpoint(root, input) {
  const checkpointRef = assertRef("checkpoint_ref", input.checkpoint_ref);
  const { paths, records } = readEvents(root);
  const state = foldReviewEvents(records.map((record) => record.event));
  const checkpoint = {
    schema: REVIEW_CHECKPOINT_SCHEMA,
    checkpoint_ref: checkpointRef,
    through_sequence: state.through_sequence,
    event_chain_digest: chainDigest(records),
    state_digest: digestBytes(jsonBytes(state)),
    state
  };
  const path = join(paths.checkpoints, `${checkpointRef}.json`);
  const replayed = writeExclusiveOrSame(path, jsonBytes(checkpoint));
  return {
    checkpoint_ref: checkpointRef,
    path,
    through_sequence: checkpoint.through_sequence,
    replayed
  };
}
