# Lyhna — Beta Readiness Report

> Lane 4 of "testing in earnest." Synthesis of the fresh-stranger install (Lane 1), 10 real dogfood
> loops (Lane 2), and the adversarial receipt audit (Lane 3), on top of the merged 30-scenario
> Reliability Gauntlet. Date: 2026-06-15. Companion docs: `STRANGER-INSTALL-REPORT.md`,
> `dogfood/DOGFOOD-LOG.md`, `RECEIPT-AUDIT.md`, `RELIABILITY-GAUNTLET.md`.

## The required answers, plainly

**How many loops run?** This phase: **10 real dogfood loops** (11 receipts, counting the two-agent
continuation) through the real proxy→witness path, plus **1 fresh-stranger install** and **2 adversarial
receipt audits**. On top of the already-merged **30-scenario Reliability Gauntlet**. Total receipts put
under honesty pressure to date: ~40 across both phases.

**How many passed first try?** All **10/10** dogfood loops behaved honestly on the first run — every
flagged case failed safe; no truth break in any surface or export. The fresh-stranger install reached a
full witnessed receipt on the first attempt, but **could not** emit OKF/PAM (the one real failure).

**What broke?**
- **Lane 1 (real failure):** the headline OKF/PAM exports had **no user-facing command** — only an
  internal demo emitted them. A stranger following the README could not produce what the README sells.
- **Lane 2/3 (truth):** nothing. Zero truth breaks across 10 loops and their exports.
- **Doc frictions:** the proxy README quick-start points at the LoopProofBundle, not the receipt; the two
  `demo:live-loop` scripts collide; `RUNNING.md` is Windows-only.

**What was fixed?**
- ✅ **Witness CLI now emits OKF + PAM** — `node src/cli.mjs <input> <outDir> --okf --pam` (additive;
  default output unchanged). README documents it. New CLI tests; 87/87 witness tests green. This closes
  the Lane-1 blocker — a stranger can now produce the full receipt + OKF + PAM from one documented command.
- (Earlier, in the merged gauntlet: mismatch now blocks `safe_to_continue`; blocked calls no longer
  narrated as having run; dedicated "Do Not Send" section; PAM wording fixes.)

**What Lyhna catches** (demonstrated on real-style loops): an agent claiming it *sent* a client email
when only a draft was created; a failed migration / blocked refund narrated as **not done**; a route
mismatch where it stays honestly content-blind about what a wrapper did; an unsent email in a two-agent
handoff; and an unwitnessed claim recorded out of order — all fail safe.

**What it cannot catch yet** (honest ceiling, unchanged): whether a real-world *outcome* happened (email
received, money moved), whether the work is *correct*, anything outside the observed tool-call path, and
— content-blind — what a wrapper call actually did or the contents behind a result hash. It is not a
universal hallucination detector.

**Remaining known limitations**
1. **Ordinal claim↔turn pairing** mis-attributes an *out-of-order* unwitnessed claim (fails safe, but
   wrong step attribution). Fix path: explicit claim↔turn correlation (deferred; `turn_ref` exists).
2. **Content-blind wrapper detection** — wrapper ops surface as "unverified," not app-cracked, in the
   real loop. Conservative and honest; don't oversell wrapper attribution.
3. **`settled` boundary clarity** (audit N1) — operator-declared settled state renders without an
   explicit "not witnessed" tag in the Markdown surfaces (PAM tags it). Owner's call to tighten.
4. **Distribution** — both repos are private and **not npm-published**; "install" today means cloning the
   repos. Fine for an invited beta; a public `npm install` beta needs packaging first.
5. **Not yet run against live MCP servers** — the loops use synthetic tool bodies (the witness is
   action-level, so this tests receipt honesty fully; a live-traffic end-to-end remains the next test).

**Could a stranger use it?** With the CLI fix: **yes, for the receipt + OKF + PAM**, from documented
commands, with a comprehensible result. The remaining stranger friction is **documentation** (the proxy
quick-start should point at the receipt path; cross-platform RUNNING.md) — small, non-truth fixes.

## Beta blockers
- **Closed:** OKF/PAM unreachable (fixed this phase).
- **Open, small (docs):** proxy README receipt pointer; cross-platform RUNNING.md; disambiguate the two
  `demo:live-loop` scripts + document the vendored-input refresh. (Recommended as one small docs PR.)
- **Open, for PUBLIC beta only:** npm publishing/packaging; a live-MCP real-traffic run.

## Verdict — GO, for a small private/invited beta

**The receipt honesty engine is beta-ready.** Across ~40 adversarial and real-style loops it is
deterministic and fails safe; no unsupported claim is laundered into a fact; DO_NOT_SEND and approval
survive both exports; and the genuine bugs found (in this phase and the gauntlet) are fixed and locked
with tests. The product's moat — action-level witnessed truth, claimed-vs-actual, content-blindness —
held under every adversarial read.

Recommended conditions before inviting testers:
1. Merge the CLI `--okf`/`--pam` fix (this phase's PR). ✅ ready
2. Land the small docs PR (proxy README → receipt path; cross-platform RUNNING.md; demo:live-loop
   disambiguation).
3. Set tester expectations to the honesty ceiling: action-level only; delivery/correctness/outcomes are
   **not** witnessed; record claims in call order; wrapper attribution is conservative; PAM is
   "PAM-shaped (`lyhna-pam/v0`)", not yet schema-validated.

**Not yet** for an unguided **public** `npm install` beta until packaging/publishing and a live-MCP
real-traffic run are done. The launch decision (private vs. public, timing) is the owner's; nothing in
this testing phase blocks a private/invited beta of the AI Work Receipt.
