# Lyhna — LLM Context Sheet

> **Last updated: 2026-06-14.** Read this first at the start of any session in this project. It is the
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
| **`lyhna-witness`** | zero-dep ESM JS (Node ≥20) | `main` | Product layer: deterministic labeler + handoff generator + CLI + OKF export + the `web/` demo. ~70 tests. |

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
   receipt: `HANDOFF.md` (readable receipt) · `handoff.json` (machine) · `next-ai-prompt.md` (continuation) ·
   `okf/` (portable bundle).
5. **`web/`** renders a committed `handoff.json` for a user or AI to audit.

### The canonical "came through the live loop" receipt
- Proxy: `scripts/live-loop-receipt.mjs` (`npm run demo:live-loop`) drives the real loop and emits
  `lyhna-mcp-proxy/examples/live-loop/witness-input.json` (deterministic; a test asserts it byte-for-byte).
- Witness: that file is vendored to `lyhna-witness/demo/live-loop-witness-input.json`;
  `demo/live-loop-witness.mjs` (`npm run demo:live-loop`) renders it to
  `lyhna-witness/examples/live-loop/` (handoff.json/HANDOFF.md/next-ai-prompt.md/okf).
- The receipt's scenario (honest, mixed): agent wrote the checkout fix (SUPPORTED) + ran tests
  (SUPPORTED) + **claimed it emailed the client an invoice but made no email tool call** →
  UNSUPPORTED / DO_NOT_SEND. This is the killer demo: "claimed but never witnessed."

---

## 5. The website (`lyhna-witness/web/`)

**Live (public):** https://lyhna-ai.github.io/lyhna-witness/

A self-contained static page (vanilla HTML/CSS/JS, no build, no backend). A visitor clicks
**Generate Witness Capsule**, watches the witnessed run animate, and gets a **Client Review AI Work
Receipt**: a 10-second verdict line, the objective, witnessed-and-supported steps, the flagged
DO-NOT-SEND step + why, safe-to-send, the next action, the buyer-facing "what this receipt proves /
what this receipt refuses to fake" section, and a **Copy receipt** button whose text includes
*"Ask your AI: does this receipt overclaim what Lyhna witnessed?"*

- **It is a REPLAY, not live.** The page renders the committed `examples/live-loop/handoff.json` — the
  receipt that came through the real loop offline. The hero says so, and the tools shown are
  **simulated** ("Demo tools. Real witness loop. Deterministic receipt rules."). Do not let the copy imply the
  browser is witnessing a live run against real systems.
- **Files:** `index.html`, `app.js`, `styles.css`, `data/handoff.js` (generated), `build-data.mjs`
  (generator), `DEPLOY.md`.
- **Data flow:** `examples/live-loop/handoff.json` --(`node web/build-data.mjs`)--> `web/data/handoff.js`
  (the browser payload). Guarded by `test/web-data.test.mjs` (byte-for-byte). If you change the
  receipt, regenerate the web data or CI fails.
- **Deploy:** `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on push to `main`
  (main-only guard on both jobs). **Pages Source must be "GitHub Actions"** (Settings → Pages) — not
  "Deploy from a branch" (that would serve the repo root, which has no index.html).

---

## 6. Current state (as of 2026-06-14)

**Shipped & merged (packaging phase complete):**
- Backend/spine + the full claimed-vs-actual loop (proxy `#21–#25`, witness `#3–#8`) — merged earlier.
- **Lane B** — canonical live-loop receipt: proxy `#26` (emits `witness-input.json`), witness `#9`
  (renders `examples/live-loop`).
- **Web demo** — witness `#10` (retarget to live-loop receipt), `#11` (tagline), `#12` (sellable
  polish), `#13` (GitHub Pages deploy), `#14` (overclaim-audit fix: "replay, not live"), `#15`
  (Client Review receipt copy + "what this receipt proves / refuses to fake").
- The demo is **live, public, and honesty-audited** (Codex review on every PR + an independent
  adversarial audit + a live-URL pass; no overclaims).

**Health:** witness `main` green (70 tests); proxy `master` green (503 tests). Check GitHub for open
PRs before starting a new lane.

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
CLI: `node src/cli.mjs <witness-input.json> [outDir] [--gate]`.

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
  `src/witnessed-event.mjs` — maps proxy events → labeler input. `src/okf.mjs` — OKF export.
  `src/cli.mjs` — the `lyhna-witness` CLI.
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
- **OKF** — a portable markdown+frontmatter projection of a handoff (`okf/`).
- **Drift gate** — CI that regenerates committed artifacts and fails if they differ (enforces determinism).
- **The loop / live loop** — the proxy standing-service run that produces a real witnessed receipt.
