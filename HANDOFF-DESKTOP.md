# Lyhna — Desktop handoff (state of play)

> **Purpose.** Bring any agent or person up to speed on where Lyhna stands so nobody works from a stale
> model. Read this first, then [`desktop/PRD-NEXT.md`](./desktop/PRD-NEXT.md) (what to build next),
> [`LLM-CONTEXT.md`](./LLM-CONTEXT.md), and [`DESKTOP-MVP-PLAN.md`](./DESKTOP-MVP-PLAN.md).
>
> **Snapshot:** `lyhna-witness main @ 7c89cd7` (2026-06-18). Engine suite green (**170** `node --test`);
> desktop suite green (**57** `vitest`, gated by `.github/workflows/desktop.yml`).
>
> **One line:** Lyhna Desktop **v1 is built in-repo** under `desktop/` (Electron + Vite/React + a tested
> zero-dep core) and runs from source; it is **not yet a shipped/downloadable product** — the next phase
> makes it one. See *§5 Where we stand* and the PRD.

---

## 0. The one correction that matters most

**Lyhna Desktop is NOT a smaller or "lite" version of `lyhna-witness`.** It is the **packaging** of the
*full* Lyhna system — the complete deterministic witness engine **plus** the existing MCP adapter — into a
**local desktop app** for people running their own agents.

Mental model:

> **local desktop app → starts/controls the local MCP adapter → agents route their tool calls through it
> → receipts land in a local receipt inbox → you open/export the capsule when you want.**

Nothing about the thesis, the honesty ceiling, the receipt, the Work Receipt Capsule, the OKF/PAM exports,
or the proof spine was reduced or replaced. Lyhna Desktop **is** `lyhna-witness` (+ the `@lyhna/mcp`
adapter), wrapped as a local app.

## 1. What Lyhna is (unchanged thesis)

Lyhna is the **independent witness in an agent's tool-call path**. It records what actually crossed the
tool boundary, compares it to what the agent *claimed*, and emits a deterministic AI Work Receipt:

- 🟢 **SUPPORTED** — claim matches what was witnessed.
- 🟡 **CLAIMED_ACTUAL_MISMATCH** — agent took a different route/action than claimed (review).
- 🔴 **UNSUPPORTED / DO_NOT_SEND** — agent claimed something the witness never saw.

**Honesty ceiling (the moat, non-negotiable):** Lyhna asserts *action-level witnessed truth only*. It
never claims delivery, business/legal/quality correctness, client behavior, "live" witnessing, or anything
outside the observed tool path. Held *tighter* than any marketing copy.

**Lyhna does not run or orchestrate agents.** It witnesses only the calls **routed through it** and does
**not** detect unrouted work: a captured claim with no matching observed call is flagged
unsupported/unwitnessed, but an action performed entirely outside Lyhna (no claim submitted) is simply
invisible — never assumed. In the UI, a not-safe run reads **"review before continuing,"** never "blocked."

## 2. The two repos (unchanged)

| Repo | What it is | State |
| --- | --- | --- |
| **`lyhna-mcp-proxy`** (TypeScript, base `master`) | The **MCP adapter** in the tool-call path. On npm as `@lyhna/mcp`. | Exists, works, published. |
| **`lyhna-witness`** (zero-dep ESM, Node ≥20, base `main`) | The **deterministic engine** (labeler + receipt generator + CLI + OKF/PAM + capsule index + inbox indexer/CLI) + the `web/` site + **the desktop app under `desktop/`**. | `main @ 7c89cd7`. |

The adapter **produces** `witness-input.json`; the witness **renders** it into the receipt/capsule. Lyhna
Desktop wraps **both**. The proxy's `LLM-CONTEXT.md` points here for product framing (PR proxy#32).

## 3. What one witnessed run produces — the Work Receipt Capsule

A capsule folder: `CAPSULE.md` + `capsule.json` (self-describing index) · `HANDOFF.md` (readable receipt) ·
`handoff.json` (machine) · `next-ai-prompt.md` (continuation) · optional `okf/` (knowledge) · optional
`pam/` (memory). Proof **references** live *inside* those artifacts when a signing key is attached — there
is **no separate "proof pack" file**. Wording: **"PAM-shaped"** (never "PAM-compatible"), **"OKF-style"**;
the **Work Receipt** is the front-door deliverable.

## 4. Positioning (website, reframed PR #48)

- Front door: **"Run your agents. Walk away. Come back to receipts."**
- Ownership: **Buy once · use with all your agents · unlimited local receipts · your receipts stay yours.**
- BYO: **Your agents use your keys, models, and tools. Lyhna gives you the receipts.**
- **"local by default"** — never **"local-only"** (cloud-hosted agents may need a remote/tunnel bridge later).
- **Kill-list (buyer surfaces), even in negative phrasing:** metered/witnessed-action pricing · free tier ·
  private-beta-as-the-frame · hosted-witness-service-as-default · plugin store · one-command install ·
  gate / authority / governance / judgment-ledger / binding / SDK. Prefer "paywalls"/"limits".
- **Signed-mode boundary stays explicit:** demo/local mode decides locally and sends nothing to Lyhna;
  signed mode (`LYHNA_API_KEY`) routes each tool call through Lyhna's hosted service to decide, so routed
  args leave the machine. Signed is an optional add-on, not the default.
- **Live site:** https://lyhna-ai.github.io/lyhna-witness/ (deploys from `main` via
  `.github/workflows/pages.yml`). Pages: `/` · `/demo.html` · `/install.html` · `/dashboard.html`
  (receipt-inbox preview, labeled *preview, not live telemetry*) · `/pricing.html`.

## 5. Where we stand — what is BUILT (all merged on `main`)

**Engine-side primitives**
- **Capsule indexer** (PR #49) — `src/capsule-indexer.mjs`: pure, deterministic read model over capsule
  folders (`indexReceiptLibrary` + `summarizeCapsuleManifest`/`summarizeHandoff`; schema
  `lyhna-inbox/v0`). Never fabricates; malformed → `unreadable` entry; degraded `handoff.json`-only mode;
  Windows-path tolerant. Tests: `test/desktop-inbox.test.mjs`.
- **Headless inbox CLI** (PR #50) — `src/inbox-cli.mjs` (`npm run inbox`): text or `--json`,
  `--include-partial`, `--limit`, `--help`; invalid root → nonzero exit. Tests: `test/inbox-cli.test.mjs`.

**The desktop app — `desktop/` (Electron + Vite/React + TypeScript; ALL product logic in a vitest-tested,
zero-dep `desktop/core/`; the Electron main is a thin shell that shells out to the engine CLIs and never
re-implements receipt/capsule semantics)**
- **#52 scaffold** — app frame (sidebar nav, hero), tested inbox view model.
- **#53 real inbox** — pick a library (or "Open bundled examples") → runs the engine inbox CLI → renders
  real rows (verdict, counts, agents, spine ids, warnings). Stale-load guarded.
- **#54 receipt detail** — click a row → readable `HANDOFF.md` (main surface) + per-step
  claimed-vs-witnessed labels (engine fields verbatim, incl. wrapper routing & returned-state) + declared
  artifacts present/missing. Tolerant of malformed/array/partial inputs (degrades, never crashes).
- **#55 sample-receipt flow** — "Create sample receipt" renders the real witness CLI on the bundled demo
  input into a fresh `lyhna-sample-receipt[-N]/` (atomic, non-destructive), labeled **sample** in inbox +
  detail (`core/sample.ts`).
- **#56 install snippets** — per-agent connect snippets (Claude Code / Codex-TOML / Cursor / Hermes /
  generic) + honest notes (two-surface, signed-mode egress, witness-scope, no-one-command).
- **#57 exports / open folder** — Open folder (OS file manager via `shell.openPath`) + Copy path on the
  detail view. Read-only; never mutates.
- **#58 adapter status** — honest panel: **never a fake "Connected"**; explains the four states + reports
  only the library-derived signal (no-library / waiting / receipts-present, never counting `unreadable`).
- **#59 packaging pass** — `electron-builder` config + `pack`/`dist` scripts + the **desktop CI workflow**
  (`.github/workflows/desktop.yml`: typecheck + vitest + vite build + electron tsc on every push/PR).

**Verified end to end, headlessly:** the node-side transports spawn the real engine CLI against
`examples/` and the inbox lists the results; sample render writes a real capsule that the inbox indexes.

**Run it (machine with a display):** `cd desktop && npm install && npm start`. Headless verification path:
`npm ci && npm run typecheck && npm test && npm run build && npm run build:electron`. See
`desktop/README.md`.

## 6. Where things live (map)

```
lyhna-witness/
  src/capsule-indexer.mjs       engine: inbox read model (lyhna-inbox/v0)
  src/inbox-cli.mjs             engine: headless inbox CLI  (npm run inbox)
  src/cli.mjs                   engine: witness renderer    (renders a capsule)
  demo/live-loop-witness-input.json   bundled sample input (Create-sample uses this)
  examples/{live-loop,agent-team}/    canonical capsules everything tests against
  web/                          the reframed marketing site (deploys to Pages)
  desktop/
    core/                       pure, vitest-tested view models (inbox/detail/sample/install/adapter)
    electron/                   thin shell: main + preload + node-only transports (inbox/receipt/sample)
    src/                        Vite + React renderer (App.tsx + styles.css)
    README.md                   run / build / package + honest caveats
  HANDOFF-DESKTOP.md (this)     state of play
  desktop/PRD-NEXT.md           what to build next (the PRD)
  DESKTOP-MVP-PLAN.md           original plan (§1–10 are pre-implementation; status block is current)
  LLM-CONTEXT.md                dated single-page map
```

**Engine path resolution (important for packaging):** the Electron main resolves the engine from the
in-repo layout and allows env overrides — `LYHNA_ENGINE_CLI`, `LYHNA_RENDER_CLI`, `LYHNA_SAMPLE_INPUT`,
`LYHNA_EXAMPLE_LIBRARY` (see `desktop/electron/main.ts`). A packaged app must bundle/locate the engine
(this is the #1 next-phase task — see the PRD).

## 7. What is NOT built yet (the next phase — do not overclaim)

- ❌ A **standalone installer / download.** The packaged app can't find the engine yet — it locates the
  sibling `lyhna-witness` engine via repo layout / `LYHNA_ENGINE_*` env. **Bundling the engine is the #1
  blocker.** No prebuilt download exists.
- ❌ **Live adapter management** (start/stop `@lyhna/mcp`, real verified "Connected"). Today: honest
  guidance + library-derived signal only.
- ❌ **Settings pane** (persist library path / engine & adapter paths / signed-mode key). Today the
  library is picked each session.
- ❌ **Receipt-signing UI**, inbox auto-refresh/`--watch`, packaging code-signing/notarization.
- ❌ Extraction to a standalone **`lyhna-desktop` repo** (staged in-repo for now).
- ❌ On-display **visual QA** (the sandbox has no display).
- ❌ Backend / signup / billing / telemetry / cloud sync — none, by design.

## 8. How we ship (every change)

One logical PR → mark ready → comment `@codex review`. **Merge only when:** all CI checks `success`
(engine `test` **and** `desktop`) + `mergeable_state` clean + Codex "no major issues" on the *current head*
+ zero unresolved review threads → **squash-merge** → reset the dev branch to base. Keep the engine's
determinism drift gates green (regenerate `examples/*` + `web/data/handoff.js` via the `demo*` scripts only
if you touch the labeler/generator/receipts). Use a **reviewer subagent for any UX/copy** before the PR.
GitHub via `mcp__github__*` only. Dev branch this session: `claude/loving-ride-obywtq`.

## 9. Reading order for a catching-up agent

1. This file. 2. [`desktop/PRD-NEXT.md`](./desktop/PRD-NEXT.md) (next work). 3. [`LLM-CONTEXT.md`](./LLM-CONTEXT.md).
4. [`THESIS.md`](./THESIS.md) + [`AGENTS.md`](./AGENTS.md) (invariants). 5. `desktop/README.md` +
`desktop/core/*` (what's built). 6. `src/capsule-indexer.mjs` + `src/inbox-cli.mjs` + `src/capsule.mjs`.
7. `examples/live-loop/` and `examples/agent-team/`.

---

**TL;DR:** Lyhna Desktop **v1 is built in-repo** (`desktop/`, Electron + React over the deterministic
engine) and runs from source — the full local loop works: select a library → inbox → receipt detail →
create a sample → install snippets → open folder → adapter status, honesty ceiling held throughout. It is
**not a download yet.** The next phase (see the PRD) turns it into a shippable product, starting with
**bundling the engine** so a packaged app runs without the repo. `main @ 7c89cd7`.
