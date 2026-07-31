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
    "snapshot": {
      "kind": "commit|worktree",
      "digest": "optional-sha256-of-inspected-worktree-snapshot",
      "coverage_ref": "coverage-manifest-id"
    },
    "turn_ref": "optional-turn-id",
    "call_ref": "optional-call-id",
    "claim_ref": "optional-claim-id",
    "review_ref": "optional-review-id"
  },
  "payload": {},
  "observed_at": "optional-host-supplied-value",
  "raw_digest": "optional-digest-of-retained-source-record"
}
```

Rules:

- `event_id`, `session_id`, `sequence`, `source`, `actor`, and `kind` are required.
- Every review lifecycle event requires `subject.repository` and `subject.head`.
- A local review of uncommitted material requires `subject.snapshot.digest`.
- A worktree snapshot digest is computed from a canonical, path-sorted list of the inspected staged,
  unstaged, and included untracked entries as `{ path, mode, content_digest }`, bound to the recorded
  head. The associated coverage manifest names exclusions and unreadable entries. Raw file contents are
  not embedded in the event envelope.
- Review currentness is keyed by repository + head + snapshot digest. Any included file-content change
  supersedes the earlier local review even when Git HEAD does not move.
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

For a clean committed review, repository + exact head identifies the inspected subject. For a local
review that includes uncommitted files, the exact head is the base and `snapshot.digest` identifies the
actual inspected bytes. A local report without that digest cannot be current for a dirty worktree.

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
    "base": "optional-sha",
    "snapshot": { "kind": "commit|worktree", "digest": "required-for-dirty-worktree" }
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
