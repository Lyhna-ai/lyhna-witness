# Lyhna Reliability Gauntlet

> **Run date:** 2026-06-15 · **Verdict:** the receipt honesty engine held — 30/30 scenarios fail safe;
> two real bugs (one truth break, one misstatement) found by adversarial review and fixed. See §7.

## 1. Objective

Do not polish; do not sell. Prove whether Lyhna survives **repeated real use**: run the full
claim → witness → receipt loop into the ground across many scenarios and find what breaks *before* a
public beta. The single question: **does the full loop actually work, repeatedly, without breaking the
honesty ceiling?**

A loop "passes" only if:
1. the proxy captures the agent's claims and the witnessed tool calls;
2. `export-pack` emits a `witness-input.json`;
3. `lyhna-witness` renders the full surface (HANDOFF.md, handoff.json, next-ai-prompt.md, `okf/`, `pam/`);
4. the receipt stays honest — **no false-safe, no unsupported claim laundered into an OKF/PAM fact, no
   "sent / done / correct" asserted unless witnessed, and DO_NOT_SEND / approval survives every export.**

## 2. Harness (what actually ran)

Every scenario is driven through the **real** standing-service loop, not a mock:

- **`lyhna-mcp-proxy/scripts/gauntlet/driver.mjs`** — a parameterized driver generalizing the canonical
  live-loop receipt. For each scenario it opens a scoped loop, has the agent route real MCP tool calls
  and record real claims, closes (seals), and runs `export-pack` — returning the emitted
  `witness-input.json`. Synthetic test doubles (same posture as the shipped demos) let a scenario choose
  each call's witnessed outcome: a programmable bind (APPROVED / ESCALATED / REFUSED) and a configurable
  upstream (success / runtime error). Scope refusals are driven the production-faithful way (a tool whose
  action class the sealed capsule disallows).
- **`reliability/run-gauntlet.mjs`** — drives each scenario through the proxy, **vendors the
  loop-produced `witness-input.json`** to `reliability/inputs/<id>.json` (provenance: produced by the
  loop, not hand-authored), renders the full witness surface, and runs the invariants.
- **`reliability/gauntlet-lib.mjs`** — the invariant engine: no-false-safe, no-laundering (OKF + PAM),
  DO_NOT_SEND/approval survive, no fabricated claim on a claimless step, every PAM item carries an
  `evidence_status`, and **determinism** (same input ⇒ byte-identical render, checked twice).
- **`reliability/scenarios.mjs`** — the 30-scenario matrix (§4), each with hand-derived expected labels.
- **`reliability/results.jsonl`** — machine-readable result per scenario.

Reproduce: from a `lyhna-witness` checkout with `lyhna-mcp-proxy` beside it (built), run
`npm run gauntlet` (or `node reliability/run-gauntlet.mjs <category>`).

**Real-loop determinism** was verified independently: the same scenario produces a byte-identical
`witness-input.json` across 3 runs (no clock/randomness leaks into the result hashes).

## 3. Scenario matrix

| # | Category | Loops | What it exercises | Expected |
|---|---|---|---|---|
| 1 | Clean supported | 10 | every claim matches a witnessed, successful call (1–3 steps, varied systems) | SAFE; all SUPPORTED |
| 2 | Claimed-but-not-witnessed | 10 | a claimed (mostly user-facing) action with no tool call; mixed with supported steps | NOT safe; UNSUPPORTED / NEEDS_EVIDENCE / DO_NOT_SEND |
| 3 | Mismatch / path | 5 | claimed route/action ≠ witnessed (system mismatch, action mismatch, Zapier wrapper, refused-with-success-claim) | CLAIMED_ACTUAL_MISMATCH survives receipt + OKF + PAM |
| 4 | Failure / approval / pairing | 5 | runtime failure, escalation (approval), unclaimed observed failure, ordinal-pairing edge | fail safe; approval stays approval; no fabrication |

**Total: 30 scenarios.** Full list with per-step expectations in `reliability/scenarios.mjs`; per-run
results in `reliability/results.jsonl`.

## 4. Results

**30 / 30 pass** the mechanical invariants (final run, after fixes). Every category is green:

| Category | Pass / Total |
|---|---|
| 1 — clean supported | 10 / 10 |
| 2 — claimed-not-witnessed | 10 / 10 |
| 3 — mismatch | 5 / 5 |
| 4 — failure/approval/pairing | 5 / 5 |

But **the first 30/30 was itself a finding**: the mechanical pass was *insufficient*. Two independent
adversarial auditors reading the actual rendered prose (the way a buyer or a skeptical client would)
caught a truth break the mechanical invariants missed — because the invariants under-specified what
"blocking" meant. That is the headline lesson: honesty bugs live in the *prose and the verdict
semantics*, not only in the label sets.

## 5. Failures found

| ID | Sev | Where | What |
|---|---|---|---|
| F1 | **P1** | `generate.mjs` (verdict) | A run whose only flag was `CLAIMED_ACTUAL_MISMATCH` (agent claimed `google`, witness saw `gmail`; the call still returned) rendered **✅ Safe to continue** and exported "Fact: safe to continue" to OKF/PAM. `safe_to_continue` deliberately ignored mismatches. This is a **false-safe** on the exact thing Lyhna sells (claimed-vs-actual), and it contradicts the canonical THESIS §9 ("Human action: review before sending"). It surfaced only because the gauntlet produced the first-ever *pure*-mismatch run — every committed example already had a DO_NOT_SEND step masking it. |
| F2 | **P2** | `labels.mjs` (note) | REFUSED and ESCALATED calls — **blocked before execution, never run** — were narrated "The tool call ran but did not succeed." Asserting an execution the witness never observed. (Affected `c4-escalated`, `c3-result-mismatch-refused`. Genuine runtime errors, which *did* run, were narrated correctly.) |
| F3 | **P2** | `generate.mjs` (HANDOFF.md) | The "Human Approval Needed" section listed DO_NOT_SEND steps that were **not** approval-gated (`needs_human_approval: []`), asserting an approval gate the witness never observed. |
| F4 | **P3** | `pam.mjs` (semantic) | Evidence-gap memory items duplicated the claim clause into a run-on ("Fact: the agent claimed send in gmail, but The agent claimed a 'send' action … but the witness saw no tool call …"). Under-claimed (safe) but muddied the export. |
| F5 | **P3** | `pam.mjs` (safe runs) | The safe-state memory said "Lyhna **witnessed** this run as safe to continue" — but witnessing is action-level; Lyhna does not witness "safety." An overclaim of what was witnessed. |

**Not bugs (verified clean by both auditors):** outcome→fact laundering (every "emailed/invoiced/posted/
refunded the client" appears only as a quoted *claim*, tagged unsupported); claimless observed failures
(`c4-no-claim-observed-failure`) are never narrated as "the agent claimed …"; wrapper content-blindness
is handled conservatively; every PAM/OKF item carries an `evidence_status`; manifests mirror the
verdict; the ordinal-pairing edge **fails safe** (see §7).

## 6. Fixes applied

- **F1 → fixed (owner ruling).** An unresolved `CLAIMED_ACTUAL_MISMATCH` now forces
  `safe_to_continue: false` (review/reconcile) — **without** becoming DO_NOT_SEND unless the step is also
  unsupported/user-facing. The mismatch is preserved clearly in HANDOFF, OKF, and PAM, and a *reconcile*
  next-action is derived. Aligns the verdict with THESIS §9. New test in `test/generate.test.mjs`. (No
  committed example changed value — all were already not-safe.)
- **F2 → fixed.** `labels.mjs` now distinguishes *blocked-before-execution* (refused/escalated → "it was
  blocked before it ran, so the tool did not execute …") from *ran-and-failed* (runtime error → "the tool
  call ran but did not succeed"). New regression test in `test/labels.test.mjs`.
- **F3 → fixed.** HANDOFF.md gained a dedicated **"## Do Not Send"** section; "## Human Approval Needed"
  now lists only true `NEEDS_HUMAN_APPROVAL` steps. (`next-ai-prompt.md` and the OKF prompt were already
  correct.)
- **F4 → fixed.** The PAM evidence-gap item now uses the human-note verbatim under a clear
  "Fact (claim not confirmed by the witness): …" / "Fact (observed, no agent claim): …" frame — no
  duplication, no mid-sentence run-on.
- **F5 → fixed.** Safe-state memory now reads "Lyhna recorded no step that blocks continuation … safe to
  continue on that basis. Witnessing is action-level — Lyhna does not witness 'safety' itself."

All committed artifacts were regenerated via the `demo*` scripts + `node web/build-data.mjs`; witness
suite **85/85**, proxy suite **509/509**, gauntlet **30/30**.

## 7. Remaining risks (honest)

1. **Ordinal claim↔turn pairing is V1-sequential.** If an agent records an unwitnessed claim *mid*-
   sequence (not in call order), the witness-bridge pairs claims to turns positionally and **attribution
   scrambles** (`c4-mispairing-edge`): the unwitnessed claim gets blamed on a later real turn, and a real
   claim reads as unwitnessed. It **fails safe** — the run is still NOT safe, and the unwitnessed
   user-facing claim never reads as supported — but the *which-step* attribution is wrong. Mitigation
   today: the agent contract is "record claims in call order." A real fix needs explicit claim↔turn
   correlation (already on the deferred list; opt-in `turn_ref` exists in the bridge).
2. **Content-blind wrapper detection.** The judgment ledger stores tool *names*, not arguments, so for a
   wrapper call (e.g. Zapier) the witness cannot read which app/action ran and conservatively marks it
   UNSUPPORTED/NEEDS_EVIDENCE. This is correct and honest, but it means the witness's argument-based
   wrapper *app-cracking* (claimed `google_docs` vs witnessed `zapier→google_docs`) **does not fire in
   the production loop** — only the route-level mismatch + "operation unverified" do. Worth a buyer-facing
   note so the wrapper story isn't oversold.
3. **`(ok)` wording for supported returns** (auditor P2/P3, not fixed): a SUPPORTED step renders
   "(ok)", though the witness only knows the call *returned without error* — "(returned)" would be
   stricter. Pervasive and debatable; left as a candidate polish, not a truth break.
4. **OKF "1 steps" pluralization** (P3 cosmetic, not fixed).
5. **PAM is still a "PAM-shaped projection (`lyhna-pam/v0`)"** — not validated against a formal published
   PAM schema. Wording stays accordingly (pre-existing deferred item).

## 8. Final verdict

**How many loops ran?** 30 distinct scenarios across all 4 categories, each driven through the real
standing-service loop, re-run after every fix (plus determinism + driver coverage).

**How many passed first try?** 30/30 on the mechanical invariants on run 1 — but adversarial prose review
then found 1 P1 + 2 P2 + 2 P3 the mechanics missed. After fixes: 30/30 mechanical **and** clean under a
full regression sweep of every auditor signature.

**What broke?** One real false-safe (mismatch → "safe to continue"), one execution misstatement
(blocked calls narrated as "ran"), one fabricated approval gate, two export wording overclaims.

**What was fixed?** All five (§6), each with a regression test where it belongs.

**What still worries us?** Ordinal-pairing attribution under out-of-order claims (fails safe, but wrong
attribution) and the content-blind wrapper limitation (§7) — both known, non-blocking, and on the
deferred list.

**Is Lyhna ready for a public beta push?** **Engineering verdict: yes, for a beta of the receipt honesty
engine.** Across 30 adversarial scenarios the loop is deterministic and fails safe; no unsupported claim
is laundered into a fact; DO_NOT_SEND and approval survive both exports; and the two genuine
truth/precision bugs are fixed and locked with tests. The conditions to set buyer expectations honestly:
(a) document the "record claims in call order" agent contract until claim↔turn correlation ships;
(b) don't oversell wrapper app-detection (it's conservative/unverified in production); (c) keep PAM
wording at "PAM-shaped." The go/no-go on *launching* is the owner's business call — but nothing found in
this gauntlet blocks it.
