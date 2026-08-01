# SPEC - Lyhna One-Product Witness Waterfall v0

**Status:** Governing architecture contract for the first shared-core build slice.  
**Date:** 2026-07-31  
**Authority:** THESIS.md remains canonical. If this file and `THESIS.md` disagree, `THESIS.md` wins.

## 1. Governing line

Lyhna is one product with one truth line:

> Lyhna records what crossed an observed tool or host boundary, keeps agent claims separate from that
> observation, compares the two by fixed rules, and gives the next human or agent an evidence-bound
> account of what happened, what was merely claimed, what a reviewer concluded, what was not observed,
> and what must be revisited.

The product is not a separate truth engine for every host. The Witness owns the canonical event
envelope, evidence classes, deterministic reducers, receipt/review objects, compatibility rules, and
feedback-delivery states. Platform packages capture and display; they do not invent Lyhna semantics.

The phrase "what happened" is always bounded to the observation surface. Lyhna can say a tool call was
attempted, blocked, returned, or absent from captured evidence. It cannot infer that a customer acted,
that business or legal work is correct, or that an unobserved real-world outcome occurred.

## 2. Product boundary

The waterfall is:

```text
@lyhna/witness - shared product contract
  canonical event envelope
  evidence classes and coverage manifest
  deterministic claim/action reducer
  deterministic review-feedback reducer
  receipt, review report, continuation, and lineage formats
  report-resource and delivery contract
        |
        +-- Generic MCP adapter
        +-- Codex adapter
        +-- Claude Code adapter
        +-- Buzz/Nostr adapter
        |
        +-- human views: receipt inbox, PR link, persistent project/canvas view
        +-- agent views: hook notice, MCP resource, exact report link
```

The package names below the shared Witness are working distribution identifiers, not separate Lyhna
products. A host may need different hooks, prompts, authentication, and display formatting. Those
differences stop at the adapter boundary.

Hard boundaries:

- Only the shared Witness reducer may assign Lyhna truth labels or review lifecycle state.
- Adapters capture host events, translate them into the canonical envelope, and deliver shared outputs; they do not redefine truth.
- A host's signed event proves attribution to that host identity under that host's rules. It does not
  prove the narrated claim is true.
- Models may author claims and evaluator reports. Models never grade those objects into witnessed fact.
- No adapter is allowed to silently omit coverage. An unavailable observation surface is recorded as a
  coverage gap.

## 3. Canonical event envelope

Every adapter emits the same logical envelope. Serialization details may be versioned, but the meaning
of each field is owned here.

```json
{
  "schema": "lyhna-event/v1",
  "event_id": "adapter-stable-id",
  "session_id": "host-session-id",
  "sequence": 17,
  "source": {
    "adapter": "codex",
    "host": "local",
    "source_ref": "host-native-reference"
  },
  "actor": {
    "kind": "agent|human|system|evaluator",
    "id": "host-attributed-id"
  },
  "kind": "claim_recorded|tool_requested|tool_returned|tool_blocked|artifact_observed|review_requested|review_started|review_reported|review_available|review_delivered|review_acknowledged|repair_started|review_superseded|review_closed|coverage_reported",
  "subject": {
    "repository": "owner/repo",
    "head": "exact-commit-sha",
    "review_scope": "whole_commit|pull_request_diff|branch_diff|worktree_diff",
    "base": "exact-base-for-diff-scope-or-null",
    "snapshot": {
      "kind": "commit|worktree",
      "digest": "optional-sha256-of-inspected-worktree-snapshot",
      "coverage_ref": "coverage-manifest-id",
      "coverage_digest": "sha256-of-sealed-coverage-manifest"
    },
    "turn_ref": "optional-turn-id",
    "call_ref": "optional-call-id",
    "claim_ref": "optional-claim-id",
    "review_ref": "required-review-id-for-review-lifecycle-events"
  },
  "payload": {},
  "observed_at": "optional-host-supplied-value",
  "raw_digest": "optional-digest-of-retained-source-record"
}
```

Rules:

- `schema` is required and must equal `lyhna-event/v1` before the event enters the reducer. A missing
  or unsupported discriminator is surfaced as incompatible input and is never interpreted under v1.
- The complete `lyhna-event/v1` envelope is type- and enum-validated before folding; validating only
  the discriminator or field presence is invalid. `event_id` and `session_id` are non-empty strings;
  `sequence` is a non-negative safe integer; `source` and `actor` are objects; `actor.kind` is exactly
  `agent`, `human`, `system`, or `evaluator`; `kind` is exactly one of the lifecycle kinds listed in the
  canonical envelope; and `payload` is a JSON object, not null or an array. `subject`, when present, is
  an object; its present references are non-empty strings; `observed_at`, when present, is a host-supplied
  string; and `raw_digest`, when present, is `sha256:<64-lowercase-hex>`. Unknown enum values, wrong JSON
  types, non-finite/fractional/negative sequences, and malformed conditional review fields are incompatible
  input and never reach either reducer.
- `event_id`, `session_id`, `sequence`, `source`, `actor`, `kind`, and `payload` are required.
- `source.adapter`, `source.host`, `actor.kind`, and `actor.id` are required non-empty fields. A
  container with no identity inside it is invalid; all four values are strings and adapters do not
  infer missing attribution later. Optional `source.source_ref` is a non-empty string when present.
- Every review lifecycle event requires `subject.repository` and `subject.head`.
- Every review lifecycle event requires `subject.review_ref`. `review_requested` creates that stable
  identity and every later lifecycle event names it explicitly; repository/head proximity never chooses
  which review an event updates.
- Every review lifecycle event requires `subject.review_scope`. The allowed values are `whole_commit`,
  `pull_request_diff`, `branch_diff`, and `worktree_diff`; adapters do not infer scope from trigger names.
- A diff-scoped review requires `subject.base`, and its currentness key includes that exact base. This
  means `pull_request_diff`, `branch_diff`, and `worktree_diff`. `whole_commit` has no base and records
  null or omits it; validation can therefore distinguish that valid absence from a malformed diff review.
- From `review_started` onward, a local review of uncommitted material requires
  `subject.snapshot.digest`.
- From `review_started` onward, every review lifecycle event requires
  `subject.snapshot.coverage_digest`. A `review_requested` event may be provisional because capture has
  not happened yet, but it cannot satisfy a current-review gate. Once capture starts, later lifecycle
  events name the same byte and coverage digests through their explicit `review_ref`; a different digest
  is a different effective review scope and supersedes the earlier report.
- `subject.repository`, `subject.head`, `subject.base`, and all `*_ref` values are non-empty strings
  when present. `subject.snapshot`, when present, is an object: `kind` is exactly `commit` or `worktree`;
  `digest` and `coverage_digest`, when present, match `sha256:<64-lowercase-hex>`; and `coverage_ref` is
  a non-empty string. The conditional presence rules above are part of v1 validation, not reducer defaults.
- Each event kind is validated against its kind-specific subject and payload schema before folding.
  A generic object-shaped payload is not sufficient. The table below defines the minimum semantic
  inputs for every v1 transition; an adapter may preserve extension fields as inert data, but neither
  reducer may derive state from an extension that is absent from this contract.

  | Event kind | Required subject fields | Required payload fields |
  |---|---|---|
  | `claim_recorded` | `claim_ref` | exactly one of `statement` or `statement_digest`; `evidence_refs` |
  | `tool_requested` | `turn_ref`, `call_ref` | `tool_name`, `capture_status`; `arguments_digest` when retained |
  | `tool_returned` | `call_ref` | `request_event_ref`, `capture_status`; `result_digest` when retained |
  | `tool_blocked` | `call_ref` | `request_event_ref`, `reason_code` |
  | `artifact_observed` | at least one of `turn_ref` or `call_ref` | `artifact_ref`, `artifact_digest` |
  | `review_requested` | common review subject | `trigger` |
  | `review_started` | common review subject | `evaluator` |
  | `review_reported` | common review subject | `report_ref`, `report_digest`, `finding_refs` |
  | `review_available` | common review subject | `report_ref`, `report_digest` |
  | `review_delivered` | common review subject | `report_ref`, `report_digest`, `audience`, `channel`, `delivery_ref` |
  | `review_acknowledged` | common review subject | `report_ref`, `report_digest`, `delivery_ref` |
  | `repair_started` | common review subject | `report_ref`, `report_digest`, `finding_refs` |
  | `review_superseded` | common review subject | `reason_code`, `superseded_by` |
  | `review_closed` | common review subject | `report_ref`, `report_digest`, `closing_review_ref`, `closing_subject`, `finding_dispositions` |
  | `coverage_reported` | `snapshot.coverage_ref`, `snapshot.coverage_digest` | `coverage_ref`, `coverage_digest` |

  The common review subject is `repository`, `head`, `review_ref`, and `review_scope`, plus the
  conditional `base` and `snapshot` fields already required above. Kind-specific values are validated
  as follows:

  - All required `*_ref`, `*_name`, `channel`, `reason_code`, provider, and identity values are non-empty
    strings. Digest fields match `sha256:<64-lowercase-hex>`.
  - `statement` is a non-empty string; `statement_digest` matches the digest format. `evidence_refs` and
    `finding_refs` are arrays of unique non-empty strings in adapter sequence order. `evidence_refs` and
    `review_reported.finding_refs` may be empty; `repair_started.finding_refs` must not be.
  - `capture_status` is exactly `retained` or `not_retained`. A retained tool request or result requires
    its named digest; `not_retained` forbids fabricating one. The return or block event's
    `request_event_ref` must resolve to a preceding `tool_requested` event with the same `call_ref`.
  - `trigger` is exactly `{ kind, ref }`, where `kind` is `checkpoint`, `manual`, `pr_ready`, `pr_comment`,
    or `final_gate`, and `ref` is non-empty. `evaluator` is exactly `{ provider, id }` with non-empty
    strings and must agree with the attributed evaluator actor.
  - `audience` is exactly `{ kind, id }`, where `kind` is `agent` or `human`; `delivery_ref` identifies one accepted host
    delivery. `review_acknowledged` must name a preceding delivery for the same review and its actor must
    match that delivery's audience. Presence in a host view alone does not synthesize acknowledgement.
  - `superseded_by` is exactly `{ review_ref, subject }`. At least one value is non-null. A non-null
    `review_ref` is a non-empty reference to the replacement review. A non-null `subject` is the
    complete canonical currentness subject
    `{ repository, head, review_scope, base, snapshot: { digest, coverage_digest } }`, including nulls
    where the subject rules permit them; it records the changed base, snapshot, or coverage identity even
    when the Git head is unchanged and no replacement review exists yet. When both values are present,
    the replacement review must resolve to that subject. `finding_dispositions` is an array of unique
    `{ finding_ref, status }` objects, where status is `addressed`, `accepted_risk`, `dismissed`, or
    `superseded`; it may be empty only when the closing report has no findings. `closing_review_ref`
    names the current exact-head review/gate that authorized closure, never the repair commit by itself.
  - `coverage_reported.payload.coverage_ref` and `coverage_digest` must equal the subject snapshot values;
    the referenced manifest must resolve and recompute as specified below. A mismatch is incompatible
    input, not a second coverage identity.
  - Every review transition resolves its required predecessor by explicit reference before it mutates review state.
    Repository/head proximity, sequence adjacency, or a shared `report_ref` without the same `review_ref`
    never supplies a missing edge. The v1 predecessor graph is:

    | Transition | Required predecessor and identity |
    |---|---|
    | `review_requested` | none; creates `review_ref` for its declared subject |
    | `review_started` | preceding `review_requested` with the same `review_ref` and every already-declared subject/currentness field |
    | `review_reported` | preceding `review_started` with the same `review_ref` and complete currentness key; its resolved canonical report resource creates immutable `report_ref`, `report_digest`, and `finding_refs` |
    | `review_available` | preceding `review_reported` with the same `review_ref`, `report_ref`, and `report_digest` |
    | `review_delivered` | preceding `review_available` with the same `review_ref`, `report_ref`, and `report_digest`; creates `delivery_ref` |
    | `review_acknowledged` | preceding `review_delivered` with the same `review_ref`, report identity, and `delivery_ref` |
    | `repair_started` | preceding `review_reported` for the same review and report identity; every named finding belongs to that report |
    | `review_superseded` | an existing state for the same `review_ref`; `superseded_by` resolves to the changed subject or replacement review |
    | `review_closed` | the target `review_reported` tuple plus a separately resolvable current exact-head closing gate |

    A request may omit capture-only snapshot fields, but `review_started` binds them and must preserve every
    subject field the request already declared. Later transitions repeat the complete currentness identity.
    Specifically, `review_available` resolves to a preceding `review_reported` with the same report tuple;
    `review_delivered` resolves to that `review_available`; and `review_acknowledged` resolves to that delivery.
    A missing, conflicting, forward, or cross-review reference is incompatible input and cannot advance state.
  - Every `repair_started.finding_refs` entry resolves to the immutable finding set of the preceding report for the same `review_ref`.
    The set may be a non-empty subset because repairs can start independently, but an unknown finding, a
    finding from another review/report, or a reference supplied only by ordinal proximity is rejected.
  - The report-digest preimage is exactly the RFC 8785 JSON Canonicalization Scheme (JCS) UTF-8 encoding of the entire resolved `lyhna-review-report/v1` object at `report_ref`.
    The object contains no `report_digest` field, so the preimage is not self-referential. The event's
    `report_digest` is `sha256:<64-lowercase-hex>` over those bytes. `review_reported` is accepted only after `report_ref` resolves, its JCS bytes recompute to `report_digest`, its `review_ref` and complete canonical subject equal the event, and the ordered unique `finding_ref` projection from its `findings` array equals `finding_refs` exactly. A missing resource, digest mismatch, duplicate finding, missing or extra finding reference, or cross-review subject is incompatible input and cannot create a reported review.
  - `review_closed.finding_dispositions` covers exactly the target report's finding set: the set of
    `finding_ref` values is equal to `review_reported.finding_refs`, with no missing, extra, or duplicate
    entry. The close event repeats that target's `report_ref` and `report_digest`. Its `closing_subject` is exactly `{ repository, head, review_scope, base, snapshot: { digest, coverage_digest } }`, reusing the canonical
    subject nesting and the same null/base and digest rules as review currentness. `closing_review_ref` resolves to the stated current exact-head gate:
    a preceding review for that exact closing subject which has reached `review_reported`,
    `review_available`, `review_delivered`, or `review_acknowledged` and has an empty finding set.
    `closing_review_ref` must still be the reducer-selected current, non-superseded review for
    `closing_subject` at the close event's position; a review whose state is `review_superseded` never
    authorizes closure merely because it once reached a reported-or-later state. If that gate is later
    superseded, or if the repository's captured currentness key no longer equals `closing_subject`, the
    prior close is historical/superseded and cannot close the current work.
- A worktree snapshot represents final inspected bytes, not Git's overlapping staged/unstaged views.
  Each included path appears exactly once as its final inspected worktree state:
  `{ path, state: "present|deleted", mode, content_digest }`. Paths are NFC-normalized,
  repository-relative POSIX strings with no `.` or `..` segments, sorted by Unicode code point;
  duplicates are invalid. For `present`, `mode` is a six-character Git octal mode string and
  `content_digest` is `sha256:<64-lowercase-hex>` over the exact raw bytes inspected, with no text,
  newline, or platform normalization (a symlink hashes its raw link-target bytes). Both are null for
  `deleted`.
- The coverage-manifest preimage is exactly
  `{ "capture_failures": <ordered-array>, "excluded": <ordered-array>, "observed_surfaces": <ordered-array>, "unavailable_surfaces": <ordered-array>, "unreadable": <ordered-array> }`.
  `observed_surfaces` contains non-empty NFC strings. `unavailable_surfaces` and `capture_failures`
  contain exactly `{ "surface": <non-empty-NFC-string>, "reason_code": <non-empty-NFC-string> }`;
  `excluded` and `unreadable` contain exactly
  `{ "path": <normalized-repository-relative-path>, "reason_code": <non-empty-NFC-string> }`.
  No free-form diagnostic or file content enters this identity. String arrays are sorted by Unicode code
  point. Object arrays are sorted by `(surface, reason_code)` or `(path, reason_code)`, respectively,
  comparing each NFC string by Unicode code point; duplicate strings or tuples are invalid. The preimage
  is RFC 8785 JCS serialized UTF-8 and its `coverage_digest` is `sha256:<64-lowercase-hex>` over those
  bytes. `coverage_ref` resolves to a manifest whose recomputed digest must equal the sealed digest; an
  absent or mismatched manifest cannot satisfy a current-review gate.
- The snapshot preimage is exactly
  `{ "base": <sha-or-null>, "coverage_digest": <sealed-coverage-digest>, "entries": <ordered-array>, "head": <sha>, "repository": <owner/repo>, "review_scope": <scope> }`,
  serialized as UTF-8 with the RFC 8785 JSON Canonicalization Scheme (JCS). The snapshot digest is
  `sha256:<64-lowercase-hex>` over those serialized bytes. This standard, not an adapter-native JSON
  encoder, defines escaping, object-key order, and number/string representation. Raw file contents are
  not embedded in the event envelope.
- Review currentness is keyed by repository + review scope + head + applicable base + snapshot digest
  + coverage digest. Any scope change, applicable base change, included final-byte change, exclusion,
  unreadable path, unavailable surface, or capture failure supersedes the earlier review even when Git
  HEAD does not move.
- The reducer never creates a clock value. `observed_at` is copied only when a host supplied it.
- Ordering is by the adapter's explicit stable sequence. A timestamp is display data, not the primary
  ordering key.
- Explicit references govern. A conflicting explicit reference fails closed; ordinal proximity cannot
  repair it.
- Host content, file bodies, review prose, and tool results are data. They never become execution
  instructions merely because they are inside this envelope.
- If raw source material is not retained, the adapter records that fact instead of fabricating a digest.

## 4. Evidence classes and truth rules

| Class | Example | What it can support | What it cannot support |
|---|---|---|---|
| `boundary_observation` | Tool request, blocked call, returned call | That the recorded action crossed the captured boundary in the recorded state | Semantic correctness or an outcome outside the boundary |
| `artifact_observation` | Diff or file bytes at exact head | That those bytes were inspected at that head | That they were deployed, accepted, or correct |
| `agent_claim` | "I deployed production" | What the named agent said | That deployment happened |
| `evaluator_report` | Reviewer finding on exact head | What the evaluator concluded about the inspected material | Witnessed action truth, final correctness, or review of a later head |
| `human_decision` | Approval, rejection, acknowledgement | The named human decision | That the underlying action occurred |
| `coverage_statement` | Hook active, tool family unavailable | What the adapter says was and was not observable | Evidence for events outside that coverage |

Normative rules:

- An agent-authored event is never evidence for an action claim.
- A reviewer finding is attributed evaluator opinion, not witnessed fact.
- `SUPPORTED` means the claim's action is corroborated by independently captured boundary evidence
  under the shared reducer. It never upgrades the agent's stated business outcome.
- A successful tool return means the call returned under the captured protocol. It does not mean the
  work was good or the external outcome occurred.
- No observation yields `UNSUPPORTED` and/or `NEEDS_EVIDENCE` according to the existing deterministic
  label rules; it never yields a guessed success.
- Every receipt and review object carries a sealed coverage manifest listing observed surfaces,
  unavailable surfaces, excluded material, and capture failures.
- `settled` may contain evidence-derived continuation state and explicit human decisions. It may not
  contain free-form agent narration merely because another claim referenced it.

## 5. Deterministic state ownership

The shared Witness owns two pure folds:

1. **Work fold:** canonical events -> claimed-vs-observed steps -> receipt/continuation state.
2. **Review fold:** canonical review events -> current review-delivery and repair state.

Both folds obey these rules:

- Identical ordered input and the same reducer version produce byte-identical output.
- No model call, wall clock, randomness, host lookup, network read, or mutable global state occurs in a
  reducer.
- The reducer version is explicit in each derived object.
- Content digest and derived-state digest are separate. A renderer change cannot silently redefine the
  evidence digest.
- Verification uses the reducer version recorded by the artifact. If that version is unavailable, the
  result is `UNVERIFIABLE_WITH_THIS_BUILD`, never a false claim that history was corrupted.
- A format change that changes canonical bytes requires a schema or reducer-version change and a
  compatibility fixture.
- Only the shared Witness reducer may assign Lyhna truth labels or review lifecycle state.

This directly removes the existing fragility where lineage can be re-folded with whatever code happens
to be running. Adapters may cache derived views, but those caches are not the source of truth.

## 6. Review feedback lifecycle

A review is a first-class, head-bound object, not a chat message and not proof that code is correct.
Every code review is bound to an exact repository head.

For a clean whole-commit review, repository + exact head identifies the inspected subject. A diff-scoped
review also records the exact base because changing that base changes the inspected diff without moving
the head. For a local review that includes uncommitted files, `snapshot.digest` identifies the final
inspected worktree bytes on top of that recorded head/base. A local report without that digest cannot be
current for a dirty worktree.

The canonical lifecycle events are:

| Event | Meaning |
|---|---|
| `review_requested` | A named trigger requested evaluation of an exact subject/head |
| `review_started` | The evaluator began or accepted the request |
| `review_reported` | The evaluator produced an attributed report and finding set |
| `review_available` | The report was stored at a resolvable resource |
| `review_delivered` | A report notice and reference were delivered to a named human or agent through a recorded channel |
| `review_acknowledged` | A named human or agent explicitly opened/acknowledged that report |
| `repair_started` | Work began in response to one or more finding references |
| `review_superseded` | The subject head changed or a newer review replaced this review |
| `review_closed` | Findings were dispositioned and the required closing review/gate was recorded |

The review fold must preserve these distinctions exactly:

`review posted != review delivered != review opened != finding addressed != new head reviewed`

Additional rules:

- Acknowledgement is not agreement and is not remediation.
- A repair commit does not close a finding by existence alone.
- A changed head makes the earlier report historical. It may still be useful, but it is not current-head
  review.
- A changed base supersedes an earlier diff-scoped review even when the head is unchanged.
- A changed dirty-worktree snapshot digest has the same effect even when the repository head is
  unchanged.
- Findings remain attributed to their evaluator and severity vocabulary. Lyhna does not convert them
  into its own fact claims.
- The report records exact head, base where applicable, inspected paths, executed checks, exclusions,
  evaluator identity, and report digest/reference.
- A review with no findings means only that this evaluator reported no findings within recorded scope.

Minimum review object:

```json
{
  "schema": "lyhna-review/v1",
  "review_id": "stable-id",
  "subject": {
    "repository": "owner/repo",
    "head": "sha",
    "review_scope": "whole_commit|pull_request_diff|branch_diff|worktree_diff",
    "base": "required-exact-sha-for-diff-scoped-review-or-null",
    "snapshot": {
      "kind": "commit|worktree",
      "digest": "required-for-dirty-worktree",
      "coverage_digest": "required-from-review-started-onward"
    }
  },
  "trigger": { "kind": "checkpoint|manual|pr_ready|pr_comment|final_gate", "ref": "host-ref" },
  "evaluator": { "provider": "host", "id": "attributed-id" },
  "status": "requested|running|reported|available|delivered|acknowledged|repairing|superseded|closed",
  "report_ref": "lyhna://reviews/{review_id}",
  "deliveries": [
    { "audience": "agent-id", "channel": "codex-hook", "status": "delivered|acknowledged", "ref": "host-ref" }
  ],
  "finding_refs": [],
  "coverage_ref": "coverage-manifest-id",
  "reducer_version": "review-fold/v1",
  "event_digest": "digest",
  "derived_digest": "digest"
}
```

## 7. Review trigger policy

PR review remains the final current-head gate, but it is too late to be the only feedback loop.

Default checkpoints:

1. **Coherent-slice checkpoint:** request independent review when the first runnable slice closes.
2. **Long-slice fail-safe:** the host adapter prompts for a checkpoint after 45 minutes of observed work
   or 20 changed files since the last review, whichever arrives first. These are configurable workflow
   defaults, not truth semantics.
3. **Before phase expansion:** review before building on top of a new contract, schema, migration, or
   security boundary.
4. **PR ready:** request exact-head review when a pull request is opened for review or moved from draft to
   ready, according to the host's supported trigger.
5. **Final gate:** after all repairs, request/recheck a review on the final exact head before merge.

For Codex today:

- A local `/review` can start a dedicated reviewer during development.
- GitHub review can be requested with the exact PR comment `@codex review`.
- Automatic GitHub review, when repository settings enable it, runs when a PR is opened for review.
- The adapter records what trigger actually fired; it does not infer a review from a green CI check or a
  prior-head comment.

Official host behavior references:

- <https://learn.chatgpt.com/docs/code-review>
- <https://learn.chatgpt.com/docs/third-party/github>

## 8. Report and delivery contract

The report is stored once and exposed through stable references:

```text
.lyhna/reviews/index.json
.lyhna/reviews/<review_id>/review.json
.lyhna/reviews/<review_id>/REPORT.md
```

`review.json` is the immutable report resource addressed by `report_ref`. Its exact top-level shape is:

```json
{
  "schema": "lyhna-review-report/v1",
  "review_ref": "stable-review-reference",
  "subject": {
    "repository": "owner/repo",
    "head": "sha",
    "review_scope": "whole_commit|pull_request_diff|branch_diff|worktree_diff",
    "base": "exact-sha-or-null",
    "snapshot": { "digest": "digest-or-null", "coverage_digest": "sealed-coverage-digest" }
  },
  "evaluator": { "provider": "host", "id": "attributed-id" },
  "coverage_ref": "coverage-manifest-id",
  "checks": [],
  "findings": [],
  "report_markdown_digest": "sha256-of-exact-REPORT.md-bytes"
}
```

The object has exactly those top-level keys. `checks` is an ordered array of attributed check objects;
`findings` is an ordered array of objects with a unique non-empty `finding_ref`. Their complete contents
are part of the JCS preimage, so an adapter cannot change evaluator prose, check output references, or a
finding while retaining the report identity. `report_markdown_digest` is the SHA-256 digest of the exact
raw `REPORT.md` bytes and therefore binds the human/agent view to the canonical resource. The shared
schema validator owns the nested check/finding shapes; adapters may not discard fields before hashing.

Runtime receipt/review data is local and uncommitted by default. An installation may choose another
data root. The logical resource remains stable:

- Open-review index: `lyhna://reviews/open`
- One review: `lyhna://reviews/{review_id}`

An adapter resolves the logical resource to a safe local file view, MCP resource, host-native object,
or authorized HTTPS URL. The canonical object stores the logical reference; disposable host URLs are
delivery metadata.

Agent delivery:

- On `review_available`, the active host adapter injects one bounded notice at the next safe turn and
  records `review_delivered` only after the host accepts that notice:
  `Lyhna review available for <exact head>. Open <report_ref> before claiming this head is reviewed.`
- The notice contains the link and summary counts, not the whole report.
- The agent can call shared operations equivalent to `list_open_reviews`, `read_review_report`, and
  `acknowledge_review`.
- Reading the report emits `review_acknowledged`. It does not automatically apply code changes.
- A Stop hook may block a claim that the current head is reviewed when the current review is missing or
  superseded. It does not block ordinary work by default.

Human delivery:

- The same report reference appears in the receipt inbox and any host-native review view.
- Codex Desktop Sources is the live third pane. Its toggleable pinned summary stays visible beside the active conversation while the human and agent continue talking.
- The Codex adapter's primary delivery target is therefore the existing Sources surface: attach the
  current report resource to the task, show its open/superseded state in the pinned summary, and retain
  the PR sidebar/review pane as the exact-head code-review view.
- A report becomes `review_delivered` to that task only after Codex accepts and displays the Source or
  report card. It becomes `review_acknowledged` only after an explicit open/read signal; mere presence in
  the pinned summary is not acknowledgement.
- In Buzz, a signed Nostr `review_available` event can carry the report reference while a Canvas view
  presents the open-review index as the persistent third panel.
- A host surface is a projection. The `.lyhna` review object and its digests remain the portable record.

The unique product loop is therefore complete and inspectable:

```text
captured work -> truthful receipt -> independent review -> report available
-> human/agent acknowledgement -> referenced repair -> new exact head -> re-review
```

## 9. Adapter waterfall

| Layer | Owns | Must not own |
|---|---|---|
| Shared Witness | Schemas, evidence classes, reducers, labels, coverage, reports, lineage, resource contract | Host authentication or UI control |
| Generic MCP adapter | MCP request/return capture, claim tool, resource exposure | Labels, settled state, review closure |
| Codex adapter | Codex hooks, capability binding, tool/turn mapping, PR/local-review notices | A second receipt reducer or second lineage meaning |
| Claude Code adapter | Claude hooks/tool mapping and report delivery | Claude-authored claims as evidence |
| Buzz/Nostr adapter | Room identity/event mapping, signed notice publication, Canvas projection | Treating signed narration as observed action truth |

Adapter conformance requires:

- The same adversarial canonical event stream produces the same shared derived object through every
  adapter.
- Adapter-specific fields live in namespaced source metadata.
- Unsupported host capabilities create coverage gaps, not optimistic defaults.
- Host prompts can tell an agent how to read a report but cannot alter the report's truth status.

## 10. Compatibility and migration

Repository roles:

- `lyhna-witness` is the canonical product and future shared-core home.
- `lyhna-mcp-proxy` remains the generic capture adapter and currently produces Witness input.
- `lyhna-codex-adapter` remains the Codex-native capture/delivery adapter while its duplicated reducer,
  receipt, and lineage logic is migrated behind compatibility fixtures.
- Future Claude Code and Buzz packages consume the same shared core.
- lyhna-core is legacy/reference material and is not the canonical shared core.

Migration rules:

1. Freeze fixtures from the current Witness, proxy, and Codex adapter before moving logic.
2. Add the canonical event and review contracts to the Witness without changing existing receipt bytes.
3. Add version-aware verification before changing continuation output or lineage semantics.
4. Make the Codex adapter call the shared reducer behind an opt-in compatibility path.
5. Prove byte or semantic parity on existing fixtures, then remove duplicated adapter logic in a later
   explicit slice.
6. Apply the same conformance suite to MCP, Claude Code, and Buzz adapters.

No current packet is silently reinterpreted. Old versions remain verifiable with their recorded reducer
when supported; otherwise they are explicitly reported as unavailable to this build.

## 11. Phased build

| Phase | Deliverable | Gate |
|---|---|---|
| 0 - contract | This spec plus an executable structural validator | Validator red-before/green-after; full Witness suite green |
| 1 - shared review spine | Canonical event/review schemas, review reducer, coverage manifest, adversarial fixtures | Pure deterministic tests; mutation proves each forbidden transition fails |
| 2 - versioned lineage | Reducer registry and version-aware re-verification | Old/current packet fixtures; unavailable version fails honestly |
| 3 - Codex delivery | Shared report resource, Sources insertion, pinned-summary state, hook notice, acknowledgement, current-head supersession | Live task shows the report in Sources while conversation continues; local review and PR fixtures; no auto-fix claim |
| 4 - MCP/Claude conformance | Thin capture/delivery adapters over shared reducers | Cross-adapter canonical stream parity |
| 5 - Buzz room surface | Nostr review notices plus persistent Canvas/open-review view | Signed authorship kept separate from action evidence; room chaos fixtures |

Each phase is one logical reviewable change. Runtime extraction does not begin until the current Codex
adapter repair PR is closed and its exact-head fixtures are frozen.

## 12. Acceptance gates

The first runtime implementation must include at least these adversarial fixtures:

1. **Claim laundering:** two identical agent claims, one citing the other. Neither claim becomes evidence
   or enters `settled` as supported work.
2. **Dirty-worktree laundering:** a local report on snapshot A followed by changed uncommitted bytes at
   the same Git head. Snapshot A must be superseded for the current worktree.
3. **Delivery laundering:** `review_reported` without `review_available` or `review_acknowledged`. The fold
   must not say the agent or human saw the review.
4. **Head laundering:** a clean review on head A followed by head B. Head B must show no current review;
   the A review is `review_superseded`.
5. **Adapter laundering:** an adapter supplies a precomputed `SUPPORTED` label. The shared reducer ignores
   or rejects it and derives the label from canonical evidence.
6. **History laundering:** a packet names an unavailable reducer version. Verification returns
   `UNVERIFIABLE_WITH_THIS_BUILD`, not valid and not corrupt.
7. **Identity laundering:** an event supplies empty `source` or `actor` containers. Validation rejects
   it before the reducer can treat unattributed input as witnessed or evaluator-authored evidence.
8. **Review collision:** two reviews share repository, head, base, and snapshot but have distinct
   `review_ref` values. Delivery, acknowledgement, supersession, and closure update only the explicitly
   referenced review.
9. **Base laundering:** a diff review is reported on base A/head H, then the base changes to B while H
   stays fixed. The A review becomes superseded and cannot satisfy a current-review gate for B..H.
10. **Snapshot duplicate laundering:** one path has both staged and unstaged Git states. The snapshot
    contains one entry for the final inspected bytes, and adapters given equivalent bytes produce the
    same digest regardless of Git status enumeration order.
11. **Scope laundering:** a diff review omits `review_scope` or declares a diff scope without an exact
    base. Validation rejects it; a declared `whole_commit` review may validly omit the base.
12. **Encoding laundering:** two adapters serialize the fixed snapshot vector with different native
    JSON formatting. Only the RFC 8785 UTF-8 preimage yields the pinned snapshot digest.
13. **Schema laundering:** an event omits `schema` or names an unsupported envelope version. It is
    surfaced as incompatible input and never folded under `lyhna-event/v1` semantics.
14. **Coverage laundering:** a report on snapshot S excludes or cannot read path A, then another report
    has the same repository, scope, head, base, and included bytes but a different coverage manifest.
    The first report cannot remain current; a missing or mismatched sealed manifest also cannot satisfy
    the current-review gate. Equivalent fixed manifest vectors from different adapters must produce the
    same pinned coverage digest.
15. **Envelope laundering:** an event uses an unknown event kind or actor kind, a fractional/negative
    sequence, a null/array payload, or a wrong-typed conditional review field. Validation rejects it as
    incompatible input before either reducer can assign semantics.
16. **Kind-specific laundering:** an otherwise well-typed event omits a transition-bearing field: for
    example, `review_delivered` has no audience/channel/report reference, `tool_returned` has no preceding
    request reference, or `review_closed` has no closing review and finding dispositions. Validation
    rejects every such event before folding; no reducer may fill the omission from proximity or defaults.
17. **Report-transition laundering:** `review_delivered` appears before `review_available`, or an
    availability/delivery/acknowledgement names a different report identity while reusing the same
    `review_ref`. Validation rejects the event and the review state does not advance.
18. **Repair-reference laundering:** `repair_started` names an unknown finding or a finding from an
    unrelated review/report. Validation rejects it; a non-empty array alone never establishes that work
    began on any reported finding.
19. **Closure-set laundering:** a close event omits one target finding, adds an unrelated finding, or
    names a stale closing gate. Validation rejects it; only exact disposition-set equality plus a
    resolvable current exact-head clean review can close the target report.
20. **Report-preimage laundering:** an adapter repeats a caller-supplied report tuple while the resource
    bytes, review subject, report digest or finding set differ. Resolution or recomputation fails and the
    report never reaches `review_reported`.
21. **Non-head supersession laundering:** a review's base, snapshot digest, or coverage digest changes at
    the same head before a replacement review exists. `superseded_by.subject` preserves the changed
    currentness identity, and the old review cannot satisfy the new subject's gate.
22. **Superseded-closing-gate laundering:** a zero-finding review is reported and then superseded before
    another report attempts to use it as `closing_review_ref`. The superseded review cannot authorize closure even when its subject tuple still compares equal.

Full gates:

- `npm run validate:waterfall`
- `npm test`
- Existing deterministic example drift gate when runtime rendering changes
- Fresh independent review against `SPEC.md` on the exact final head
- Zero unresolved correctness findings at that head before merge

## 13. Loop Contract

| Field | Contract for phase 0 |
|---|---|
| Goal | Establish the enforceable one-product waterfall and feedback-loop boundary in the canonical Witness repo |
| Verifier | `node scripts/validate-waterfall-spec.mjs` plus `node --test` |
| Verifier tier | Tier 1 for structural and regression checks; product judgment remains Adam's acceptance |
| Turn cap | 3 repair cycles |
| Spend cap | $5 |
| Wall cap | 60 minutes |
| Stop on success | Structural validator and full Witness suite pass with a frozen source tree |
| Stop on failure | Any cap fires, `no_progress_for(2)`, or a required decision would change the product boundary |
| Side effects | Local branch/worktree and files only; no push, PR, merge, publish, install, or external message |
| State owner | This `SPEC.md` owns the phase boundary; test output owns verification status; Git owns file state |

Required loop signals:

| Signal | Source |
|---|---|
| `goal_score` | Required headings/rules satisfied and acceptance artifacts present |
| `safety_flag` | Honesty-ceiling and adapter-boundary checks |
| `verifier_status` | Process exit code plus test counts |
| `progress_delta` | Failing checks removed or new scoped evidence added |
| `resource_usage` | Repair cycles, spend estimate, and elapsed wall time |
| `external_effects` | Explicit list; empty in phase 0 |

## 14. Not built in this slice

- No shared event/review runtime module yet.
- No reducer or receipt code moved out of the Codex adapter yet.
- No changes to the open Codex adapter repair PR.
- No Codex hook installation or automatic report acknowledgement.
- No automated Codex Sources insertion or pinned-summary refresh yet. The live third-pane surface exists;
  this slice defines it as the Codex adapter's primary human delivery target.
- No Buzz/Nostr events, Canvas UI, Claude Code hooks, or MCP resource server.
- No automatic application of reviewer findings.
- No claim of universal truth, correctness, certification, delivery, or real-world outcome verification.
