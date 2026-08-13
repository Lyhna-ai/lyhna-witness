# SPEC — Lyhna Review Continuity Slice 2

**Status:** Executable Slice 2 contract.
**Date:** 2026-08-13
**Authority:** `THESIS.md` remains canonical. If this file and `THESIS.md` disagree, `THESIS.md` wins.

## 1. Scope

Slice 2 gives the shared Witness a deterministic review-continuity object that adapters can feed and
render. It preserves reviewer findings across checkpoints and process restarts, binds every review to
the exact committed subject that was inspected, collapses repeated evidence into one inline finding,
and makes acknowledgement depend on a successful verified read of the report bytes.

This slice records observations and attributed reviewer findings. A finding remains reviewer-authored
opinion. Lyhna does not approve work, block work, judge business or code correctness, or act as an
authority. Host adapters decide how to display the shared state without changing its meaning.

## 2. Exact reviewed subject

Every lifecycle event repeats one canonical subject:

```json
{
  "repository": "owner/repository",
  "head": "40-lowercase-hex-commit-sha",
  "scope": "whole_commit|pull_request_diff",
  "base": "40-lowercase-hex-commit-sha-or-null"
}
```

`pull_request_diff` requires an exact base. `whole_commit` requires `base: null`. Repository, head,
scope, and base form the complete subject identity. Events from another head or base cannot mutate the
review, satisfy its read, acknowledge its report, or deduplicate its findings.

Dirty-worktree identity and cross-host snapshot canonicalization are deferred. This slice accepts only
committed subjects because the real Review Relay and GitHub review flows inspect committed heads.

## 3. Persistent event fold and checkpoints

The filesystem store owns append-only, exclusively-created event records. Callers provide stable event,
review, report, delivery, read, checkpoint, evidence, and audience references; the Witness never uses a
clock, randomness, or a model to create state. Replaying the same event reference with byte-identical
content is idempotent. Reusing it with different content fails closed.

The reducer consumes events in their stored sequence order. It never reorders by timestamp or model
output. A checkpoint contains the folded state, the exact event-prefix sequence, the prefix chain digest,
and the state digest. Restart loading verifies those bindings before folding later events. A missing or
mismatched checkpoint cannot supply state.

## 4. Findings and inline de-duplication

A reviewer finding is normalized as:

```json
{
  "reviewer_ref": "stable reviewer identity",
  "severity": "P0|P1|P2|P3",
  "title": "non-empty reviewer title",
  "body": "non-empty reviewer explanation",
  "path": "repository-relative path or null",
  "line": "positive integer or null"
}
```

The deterministic `finding_ref` is the SHA-256 of the canonical subject plus those normalized finding
fields. The evidence reference is deliberately outside that identity. Repeated evidence for the same
finding, including evidence replayed after a checkpoint or restart, adds at most one evidence reference
and never creates a second inline finding. Distinct evidence references may support the same one finding.

Inline feedback is a projection of the persisted fold, not a second mutable store. It names the exact
reviewed head, finding reference, attributed severity and text, location, and de-duplicated evidence
references. It makes no completion, approval, or correctness claim.

## 5. Report delivery, verified read, and acknowledgement

The report resource contains exact `REPORT.md` bytes plus a manifest bound to the review reference,
canonical subject, ordered finding references, and `markdown_digest` (`sha256:<64-lowercase-hex>` over
the raw Markdown bytes). Publishing or delivery is not a read.

`readReviewReport` performs one verified read:

1. resolve the published report and the named delivery for the same review, subject, and audience;
2. read `REPORT.md` immediately;
3. recompute and compare the raw-byte Markdown digest;
4. only after success, append `report_read_verified` naming the report, delivery, audience, and digest;
5. return exactly the verified Markdown bytes.

Missing, unreadable, or altered Markdown produces no bytes and no verified-read event.

`acknowledgeReview` has exactly one accepted predecessor: a prior successful `report_read_verified`
event for the same review, canonical subject, report, delivery, audience, and Markdown digest. Report
availability, generation, publication, delivery, a cached digest check, or a caller-supplied read name
cannot substitute for that event. A failed or skipped read emits no `review_acknowledged` event.

Acknowledgement means only that the named audience successfully read bytes that the Witness verified.
It does not mean the audience agreed, the finding was repaired, or the reviewed work was correct.

## 6. Review Relay reconciliation

Review Relay R0 supplies useful upstream exact-head evidence: append-only receipts, captured reviewer
output, structured findings, base/head binding, and separate dispositions. Lyhna may record those receipt
and finding references as attributed evidence. It does not copy Relay's infrastructure-specific gate,
Claude execution, environment hardening, filesystem-tamper, or recovery backlog into this slice.

The nine deferred Relay P2/P3 items do not break this real Lyhna flow: they concern Relay subprocess
exit handling, ambient Git environment, repository customization claims, stdout digest naming, uncommon
setup exceptions, Claude upgrades, malformed global inbox files, builder-chosen base, and Relay-specific
cleanliness documentation. Slice 2 keeps its own boundary narrow and fail-closed.

## 7. Executable acceptance

- A finding recorded for an exact committed head survives a checkpoint and a new store instance.
- Replaying identical evidence, before or after restart, yields one inline finding.
- A different exact head has a different review subject and cannot consume the earlier finding/read.
- Deleting or changing `REPORT.md` makes `readReviewReport` fail without a verified-read event.
- `acknowledgeReview` fails without a successful matching verified-read event.
- A successful read followed by acknowledgement remains present after restart.
- `npm test` and `npm run validate:waterfall` pass.

## 8. Not built in this slice

- no reviewer runner, scheduler, notification service, merge operation, or deployment action;
- no model invocation or authority decision;
- no dirty-worktree review identity;
- no concurrent multi-writer protocol or hostile same-user filesystem-tamper defense;
- no import of Review Relay's deferred infrastructure-hardening backlog;
- no change to receipt labels, generated demo artifacts, proof-spine bytes, web copy, or Desktop UI.
