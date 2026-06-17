# Lyhna — LLM Context Sheet

> **Last updated: 2026-06-17.** Read this first at the start of any session in this project. It is the
> single source of truth for *what Lyhna is now*, how the pieces fit, what's live, and the rules for
> changing things safely. If you change something material, update this file's date and the relevant
> section in the same PR.

---

## 1. What Lyhna is (in one breath)

**Lyhna sells "AI Work Receipts your clients can trust."** It witnesses an AI agent's *real tool calls*,
compares them to what the agent *claimed* it did, and prints a deterministic, honest receipt:

- 🟢 **SUPPORTED** — the claim matches what crossed the tool boundary.
- 🟡 **CLAIMED_ACTUAL_MISMATCH** — the agent took a different route/action than it claimed (review note).
- 🔴 **UNSUPPORTED / DO_NOT_SEND** — the agent claimed something the witness never saw happen.

**Buyer:** AI agencies, bookkeepers, ops teams, VAs — anyone who white-labels the receipt to *their*
clients ("before your AI tells a client 'done,' get the receipt").

**The moat = the honesty ceiling.** Lyhna only asserts *action-level witnessed truth*, and the receipt
shows what was proven, what lacked evidence, and what Lyhna refuses to fake. That discipline lets the demo survive
"have your own AI audit this receipt." Never trade it away for a punchier claim.

---

## 2. The honesty ceiling (V1 — non-negotiable)

The witness is **action-level only**. It compares what crossed the tool-call boundary to what the
agent claimed. Canonical source: `THESIS.md` (witness repo). The receipt UI frames this as:

**What this receipt proves:** what actually crossed the tool boundary, whether each claim has
witnessed support, where support is missing or mismatched, and what is safe to continue from.

**What this receipt refuses to fake:** client behavior, business/legal correctness, agent confidence
as evidence, or anything outside the observed workflow.

If a change would make any surface imply more than the above (e.g. "the email was sent," "the work is
correct," "this happened live"), it is an **overclaim** — do not ship it.

---

## 3. Architecture — two repos (GitHub org: `Lyhna-ai`)

| Repo | Language | Base branch | What it is |
| --- | --- | --- | --- |
| **`lyhna-mcp-proxy`** | TypeScript | `master` | Runtime MCP proxy in the tool-call path. Witnesses real tool calls, captures agent claims, and exports a `witness-input.json`. ~503 tests. |
| **`lyhna-witness`** | zero-dep ESM JS (Node ≥20) | `main` | Product layer: deterministic labeler + handoff generator + CLI + OKF + PAM exports + the `web/` demo. ~80 tests. |

The proxy **produces** the witness input; the witness **renders** it into the user-readable receipt. Neither
imports the other's internals — the witness mirrors the proxy's event vocabulary (Integration Option A).

---

## 4. The loop (claim capture → witness → receipt), end to end

1. **Agent records a claim** via the proxy's `record_claim` MCP tool (opt-in, env
   `LYHNA_PROXY_CLAIM_CAPTURE=1`). The agent can *write* claims but can **never read** the witnessed
   ledger back.
2. **Proxy witnesses** the real tool calls through the standing-service loop (judgment ledger:
   verdict APPROVED/ESCALATED/REFUSED + runtime report `returned`/hashes).
3. **Loop close → `export-pack`** pairs the agent's claims with the witnessed judgment turns
   (`assembleWitnessInput`) and emits **`witness-input.json`** (verified-context only; plaintext).
4. **`lyhna-witness <witness-input.json>`** applies the deterministic labeler and writes the
   **AI Work Receipt Capsule**: `CAPSULE.md` + `capsule.json` (the capsule's self-describing index —
   every artifact + the trust boundary it carries) · `HANDOFF.md` (readable receipt) · `handoff.json`
   (machine) · `next-ai-prompt.md` (continuation) · and, with `--okf`/`--pam`, `okf/` (knowledge bundle) ·
   `pam/` (PAM-shaped memory projection — every item carries its evidence_status). The capsule index is
   written by default; it asserts nothing new (`lyhna-capsule/v1`, `src/capsule.mjs`).
5. **`web/`** renders a committed `handoff.json` for a user or AI to audit.

### Claim-to-action receipt contract (the spine, `src/contract.mjs`)
Each receipt step can carry an optional **`contract`** block that attributes the claim and links it to the
witnessed call: `agent_id` · `subagent_role` · `claim_id` · `claim_turn_id` · `turn_ref` · `call_id` ·
`artifact_id` (optional, never fabricated) · `claimed/observed_action_family` · `claimed/observed_result_state`
(observed is never "success" — only "returned"/"blocked_*"/"error"/"no_observed_call") · a rolled-up
`status` (supported/unsupported/mismatch/needs_evidence/needs_approval) · `link_basis` · `reader_explanation`
(agent-attributed but bounded to the witnessed note). Run level adds `parent_loop_id`, `receipt_id`, and an
`agents` summary (captured evidence only — an agent whose tool path wasn't routed through Lyhna never
appears). The spine is surfaced across **every export** when present: HANDOFF.md (a per-step `Contract:`
footnote + an `Agent Attribution` section), next-ai-prompt.md, OKF (step frontmatter + reader_explanation
+ an `Agents` section), the PAM-shaped bundle (per-item attribution beside `evidence_status`; run spine in
the manifest), and the capsule index. **Backward-compatible & opt-in:** the contract is attached ONLY when the input carries a
meaningful spine signal, so a plain run is byte-identical to before. An **explicit** `claim_turn_id ↔
turn_ref` link governs over ordinal pairing; a **conflict** drops the mis-linked call so the claim fails
safe to unsupported.

### The canonical "came through the live loop" receipt
- Proxy: `scripts/live-loop-receipt.mjs` (`npm run demo:live-loop`) drives the real loop and emits
  `lyhna-mcp-proxy/examples/live-loop/witness-input.json` (deterministic; a test asserts it byte-for-byte).
- Witness: that file is vendored to `lyhna-witness/demo/live-loop-witness-input.json`;
  `demo/live-loop-witness.mjs` (`npm run demo:live-loop`) renders it to
  `lyhna-witness/examples/live-loop/` (handoff.json/HANDOFF.md/next-ai-prompt.md/okf/pam).
- The receipt's scenario (honest, mixed): agent wrote the checkout fix (SUPPORTED) + ran tests
  (SUPPORTED) + **claimed it emailed the client an invoice but made no email tool call** →
  UNSUPPORTED / DO_NOT_SEND. This is the killer demo: "claimed but never witnessed."

---

## 5. The website (`lyhna-witness/web/`)

**Live (public):** https://lyhna-ai.github.io/lyhna-witness/

A self-contained, multi-page **marketing site** (vanilla HTML/CSS/JS, no build, no backend) on the
**receipt grammar** — the green/amber/red verdict palette on a clean, monospace-tinged document surface.
Anchor noun: **proof** (proof of *witnessed tool-boundary action* — never outcome/delivery/correctness).
Pages (each links the others via a shared header/footer nav):

- **`index.html`** — the homepage. Sells the why: hero ("Prove what your agents did"), the receipt's
  three verdict states (SUPPORTED / MISMATCH / DO-NOT-SEND), the **honesty ceiling as the differentiator**
  ("It tells you less than other tools. On purpose."), the agent-native trio (MCP / OKF / PAM-shaped
  memory bundle), carrier-vs-witness, and a demo CTA. Static, no JS.
- **`demo.html`** — the demo, *replayed*. A visitor clicks **Generate Witness Capsule**, watches the
  witnessed run animate, and gets the **Client Review AI Work Receipt** (10-second verdict, supported
  steps, the flagged DO-NOT-SEND + why, the "proves / refuses to fake" section, and a **Copy receipt**
  button: *"Ask your AI: does this receipt overclaim?"*). Loads `app.js` + `data/handoff.js`.
- **`install.html`** — honest **private-beta** install: an MCP proof layer in the tool path; setup is
  stated as *guided, not one-command*; the one concrete command is the real witness CLI render. No
  `lyhna.com`, no one-command promise.
- **`pricing.html`** — the billing **model** only ("metered by witnessed action"; billing keys on
  *was a tool call observed?*, whatever its verdict — a claim with no observed call isn't billed).
  **No pricing numbers** — they "open with the private beta."

- **The demo is a REPLAY, not live.** `demo.html` renders the committed `examples/live-loop/handoff.json`
  — the receipt that came through the real loop offline. Tools are **simulated** ("Demo tools. Real
  witness loop. Deterministic receipt rules."); framed as a "demo scenario, replay." Never imply the
  browser is witnessing a live run.
- **Honesty ceiling applies to the marketing too** — tighter than any deck. No surface may imply
  outcome/delivery/correctness/client-behavior truth; prefer "what crossed the tool boundary"; keep
  "AI Work Receipt"; **PAM-shaped** (never "PAM-compatible"); no pricing numbers and no open/one-command
  install claim until they are real/approved; kill-list scrubbed (no gate/authority/governance/
  judgment-ledger/binding/SDK on buyer surfaces). Codex review on each web PR catches copy overclaims
  (e.g. it caught an absolute "It didn't" non-occurrence claim, fixed to "Lyhna saw no such call").
- **Files:** `index.html`, `demo.html`, `install.html`, `pricing.html`, `styles.css`, `app.js`
  (demo only), `data/handoff.js` (generated), `build-data.mjs` (generator), `README.md`, `DEPLOY.md`.
- **Data flow:** `examples/live-loop/handoff.json` --(`node web/build-data.mjs`)--> `web/data/handoff.js`
  (the demo's browser payload). Guarded by `test/web-data.test.mjs` (byte-for-byte). If you change the
  receipt, regenerate the web data or CI fails.
- **Deploy:** `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on push to `main`
  (main-only guard on both jobs). **Pages Source must be "GitHub Actions"** (Settings → Pages). `/` is the
  homepage, `/demo.html` the demo. Pixel/mobile QA needs a real browser (none in the sandbox) — do a
  desktop+mobile look on the deployed preview per web PR.

---

## 6. Current state (as of 2026-06-15)

**Shipped & merged (packaging phase complete):**
- Backend/spine + the full claimed-vs-actual loop (proxy `#21–#25`, witness `#3–#8`) — merged earlier.
- **Lane B** — canonical live-loop receipt: proxy `#26` (emits `witness-input.json`), witness `#9`
  (renders `examples/live-loop`).
- **Web demo** — witness `#10` (retarget to live-loop receipt), `#11` (tagline), `#12` (sellable
  polish), `#13` (GitHub Pages deploy), `#14` (overclaim-audit fix: "replay, not live"), `#15`
  (Client Review receipt copy + "what this receipt proves / refuses to fake").
- The demo is **live, public, and honesty-audited** (Codex review on every PR + an independent
  adversarial audit + a live-URL pass; no overclaims).

**Reliability gauntlet (2026-06-15):** `reliability/` drives the **real** loop across a 30-scenario
matrix (clean / claimed-not-witnessed / mismatch / failure-approval-pairing), renders every surface, and
asserts the honesty invariants (`npm run gauntlet`; needs the sibling proxy's
`scripts/gauntlet/driver.mjs`). Report: `RELIABILITY-GAUNTLET.md`. It found + fixed two truth bugs:
(1) a **route-only `CLAIMED_ACTUAL_MISMATCH` now blocks `safe_to_continue`** (review/reconcile — not
DO_NOT_SEND unless also unsupported/user-facing), aligning the verdict with THESIS §9; previously a
pure-mismatch run read as safe. (2) refused/escalated calls are no longer narrated as having "run" (they
are blocked before execution). Also: HANDOFF.md now has a dedicated "Do Not Send" section and reserves
"Human Approval Needed" for true `NEEDS_HUMAN_APPROVAL` steps. Known residual: ordinal claim↔turn pairing
fails safe but can mis-attribute an out-of-order unwitnessed claim (deferred: claim↔turn correlation).

**Testing in earnest (2026-06-15):** beyond the gauntlet, a fresh-stranger install, 10 real dogfood
loops (`dogfood/`), and a 2-auditor adversarial receipt audit were run. Reports: `STRANGER-INSTALL-REPORT.md`,
`dogfood/DOGFOOD-LOG.md`, `RECEIPT-AUDIT.md`, `BETA-READINESS-REPORT.md`. Zero truth breaks in the
receipts; the one real failure was that **OKF/PAM had no user-facing command** — fixed by adding
`--okf`/`--pam` to the CLI. Verdict: **GO for a small private/invited beta** of the AI Work Receipt,
conditioned on a small docs PR (proxy README → receipt path; cross-platform RUNNING.md) and honest buyer
expectations. Open follow-ups: ordinal claim↔turn correlation; live-MCP real-traffic run; npm packaging
for a public beta; optional `settled`-section attribution (audit N1).

**Website relaunch (2026-06-15):** the `web/` site became a multi-page **marketing site** on the receipt
grammar (see §5): homepage (merged), honest private-beta install (merged), pricing-model page (numbers
held), and a demo-page redesign — implemented page-by-page from a copy deck, each a gated PR with an
overclaim audit. Pricing/free-tier numbers and an open install flow are intentionally **not** published
(owner decisions). The demo is preserved at `/demo.html`.

**Health:** witness `main` green (88 tests); proxy `master` green (512 tests). Check GitHub for open
PRs before starting a new lane.

**Carriers vs. the witness (the export bet):** OKF and PAM are *carriers* (transport integrity — a
bundle was not altered). Lyhna is the *witness* (origin integrity — whether the contents reflect work
that crossed the tool boundary). Lyhna does not compete with these formats; it **feeds** them. Each
handoff already projects into `okf/` (knowledge) and `pam/` (memory), with the evidence verdict baked
into every item so a consumer inherits the honesty ceiling instead of stripping it. The carrier is a
consumer of Lyhna, not Lyhna. (PAM wording stays "PAM-shaped projection / `lyhna-pam/v0`" until matched
against a formal PAM schema.)

**Deferred / next lanes (NOT V1 blockers):** real beta-capture path (mailto/Tally/waitlist) to replace
the static "Private beta soon"; buyer copy + MCP install instructions; proxy README repositioning onto
"witness"; live Zapier/Gmail demos; concurrency-safe claim↔turn correlation (opt-in sequential is fine
for V1).

---

## 7. How to work in each repo

### `lyhna-witness` (Node ≥20, zero deps)
```bash
npm test                 # node --test — full suite (~70)
npm run demo             # regenerate examples/hermes-zapier
npm run demo:live        # examples/zapier-google
npm run demo:real        # examples/live-google
npm run demo:gmail       # examples/live-gmail
npm run demo:live-loop   # examples/live-loop  (the canonical receipt)
node web/build-data.mjs  # regenerate web/data/handoff.js from examples/live-loop/handoff.json
```
CLI: `node src/cli.mjs <witness-input.json> [outDir] [--gate] [--okf] [--pam]`. By default it writes the
handoff trio **plus the capsule index** (`CAPSULE.md` + `capsule.json`). `--okf`/`--pam` are additive —
they also write the OKF knowledge bundle (`<outDir>/okf/`) and the PAM-shaped memory bundle
(`<outDir>/pam/`), and the capsule index then lists them. `npm run gauntlet` runs the reliability
gauntlet (needs the sibling proxy).

### `lyhna-mcp-proxy` (TypeScript)
```bash
npm install              # first, for @types/node etc.
npm run build            # tsc -> dist/
npm run check            # tsc --noEmit (typecheck)
npm test                 # vitest run — full suite (~503)
npm run demo:live-loop   # drive the real loop -> examples/live-loop/witness-input.json
```
Public CLI: `lyhna-mcp export-pack` / `export-loop-proof` (in `dist/src/bin/cli.js`).

### Drift gates (these will fail CI if you forget to regenerate)
- **Witness CI** regenerates all `demo*` scripts and checks `examples/` for drift. After changing the
  labeler/generator or any receipt, run the demos AND `node web/build-data.mjs`, then commit the output.
- **Proxy CI** runs typecheck + build + test + cold-verify legs.

---

## 8. The PR / review workflow (how every change ships)

1. Work on a dev branch (this session used `claude/nice-bell-c866a0`; base = witness `main` / proxy `master`).
2. One logical change per PR. Open it, mark ready, comment **`@codex review`** (mark-ready alone often
   misses the trigger).
3. **Merge gate — ALL must hold on the *current* head SHA:** every CI check `success` · `mergeable_state`
   clean · Codex bot "Didn't find any major issues" on that exact commit · **zero unresolved review
   threads**.
4. If Codex flags P1/P2 and the fix is small + unambiguous + in-scope: fix, re-run tests, push,
   **resolve the threads**, re-comment `@codex review`. If ambiguous/architectural or it touches a
   guardrail below: stop and ask the project owner.
5. **Squash-merge.** Then reset the dev branch to base (`git fetch origin <base>; git reset --hard
   origin/<base>; git push -f`).
6. GitHub MCP tools only (`mcp__github__*`); no `gh` CLI in this environment.

Codex catches real, product-relevant bugs (overclaims, edge-case verdict logic). Treat it as the
second engineer; don't merge around it.

---

## 9. Guardrails — do NOT touch without explicit project-owner sign-off

- **Proof spine (proxy):** no changes to the signed bundle / receipt shape / canonicalization. The
  `witness-input.json` is an *additive*, verified-context-only sidecar.
- **Witness determinism:** the labeler/generator must stay deterministic — **no clock, no model calls,
  no randomness**. Same input ⇒ byte-identical output (the drift gates enforce this).
- **Claim capture posture:** opt-in · verified-context only · during-run only · fail-closed. The agent
  can write claims but can **never** read/forge the witnessed ledger.
- **The honesty ceiling (§2):** never let any surface (receipt, web copy, README) overclaim. No
  delivery confirmation, no outcome/quality verification, no "live witnessing" implication, no
  universal hallucination-detection claims.
- **`examples/live-loop` data:** the receipt is generated, not hand-edited. Regenerate via the scripts;
  don't tweak the committed JSON by hand.

---

## 10. Key files map

**lyhna-witness**
- `THESIS.md` — the product thesis + honesty ceiling (canonical). `BUILD-PLAN.md`, `HUMAN-GUIDE.md`,
  `PROJECT-BRIEF.md` — supporting docs.
- `src/labels.mjs` — deterministic trust labels. `src/generate.mjs` — handoff builder + renderers.
  `src/witnessed-event.mjs` — maps proxy events → labeler input. `src/okf.mjs` — OKF (knowledge) export.
  `src/pam.mjs` — PAM (memory) projection. `src/capsule.mjs` — the capsule index (CAPSULE.md +
  capsule.json). `src/contract.mjs` — the claim-to-action receipt contract (spine). `src/cli.mjs` —
  the `lyhna-witness` CLI.
- `demo/*.mjs` — regenerate `examples/*`. `examples/live-loop/` — the canonical receipt.
- `web/` — the live demo (see §5). `.github/workflows/{ci.yml,pages.yml}`.

**lyhna-mcp-proxy**
- `src/claim-recorder.ts`, `src/record-claim-tool.ts` — agent claim capture.
- `src/judgment-ledger.ts`, `src/judgment-recorder.ts` — the witnessed ledger.
- `src/witness-bridge.ts` — `assembleWitnessInput` (pairs claims ↔ turns).
- `src/supervisor-cli.ts` — `export-pack` (emits `witness-input.json`).
- `scripts/live-loop-receipt.mjs` — drives the real loop for the canonical receipt.
- `AGENTS.md`, `RUNNING.md`, `docs/` — proxy docs.

---

## 11. Glossary

- **Witness / witnessed** — what the proxy actually observed crossing the tool-call boundary.
- **Claim** — what the agent *says* it did (via `record_claim`); the agent's voice, never trusted blind.
- **Receipt / handoff / capsule** — the rendered claimed-vs-actual output (`handoff.json` + `HANDOFF.md`).
- **`witness-input.json`** — the proxy's emitted pairing of claims with witnessed turns; the witness's input.
- **Honesty ceiling** — the fixed set of things Lyhna can/cannot assert (§2).
- **OKF** — a portable markdown+frontmatter *knowledge* projection of a handoff (`okf/`).
- **PAM** — Portable Agent Memory; Lyhna's PAM-shaped *memory* projection of a handoff (`pam/`,
  `lyhna-pam/v0`), each item tagged with its evidence_status.
- **Carrier vs. witness** — carriers (OKF/PAM) prove transport integrity; Lyhna proves origin integrity
  (what crossed the tool boundary). Lyhna feeds the carriers; the carrier is a consumer of Lyhna.
- **Drift gate** — CI that regenerates committed artifacts and fails if they differ (enforces determinism).
- **The loop / live loop** — the proxy standing-service run that produces a real witnessed receipt.
