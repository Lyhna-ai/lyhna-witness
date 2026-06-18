# Lyhna — Desktop pivot handoff

> **Purpose.** Bring any agent or person up to speed on where Lyhna is **after the Desktop pivot**, so
> nobody works from a stale model. If you only read one thing before touching Lyhna Desktop work, read
> this, then [`LLM-CONTEXT.md`](./LLM-CONTEXT.md) and [`DESKTOP-MVP-PLAN.md`](./DESKTOP-MVP-PLAN.md).
>
> **Snapshot:** `lyhna-witness main @ 862d8fb` (2026-06-18), suite green (170 `node --test`).

---

## 0. The one correction that matters most

**Lyhna Desktop is NOT a smaller or "lite" version of `lyhna-witness`.** It is the **packaging** of the
*full* Lyhna system — the complete deterministic witness engine **plus** the existing MCP adapter — into a
**local desktop app** for people running their own agents.

Mental model:

> **local desktop app → starts/controls the local MCP adapter → agents route their tool calls through it
> → receipts land in a local receipt inbox → you export the capsule when you want.**

Nothing about the thesis, the honesty ceiling, the receipt, the Work Receipt Capsule, the OKF/PAM exports,
or the proof spine was reduced or replaced. We changed **who it's for and how it's delivered**, not what it
is. If anyone thinks we're building a minimal product *separate from* `lyhna-witness`, that's wrong — Lyhna
Desktop **is** `lyhna-witness` (+ the `@lyhna/mcp` adapter), wrapped as a local app.

## 1. What Lyhna is (unchanged thesis)

Lyhna is the **independent witness in an agent's tool-call path**. It records what actually crossed the
tool boundary, compares it to what the agent *claimed*, and emits a deterministic AI Work Receipt:

- 🟢 **SUPPORTED** — claim matches what was witnessed.
- 🟡 **CLAIMED_ACTUAL_MISMATCH** — agent took a different route/action than claimed (review).
- 🔴 **UNSUPPORTED / DO_NOT_SEND** — agent claimed something the witness never saw.

**Honesty ceiling (the moat, non-negotiable):** Lyhna asserts *action-level witnessed truth only*. It
never claims delivery ("the email was sent"), business/legal/quality correctness, client behavior, "live"
witnessing, or anything outside the observed tool path. Held *tighter* than any marketing copy.

**Lyhna does not run or orchestrate agents.** It witnesses only the calls **routed through it**, and it
does **not** detect unrouted work. The boundary is precise: a *captured claim* with no matching observed
call is flagged unsupported/unwitnessed — but an action an agent performs entirely outside Lyhna, with no
claim submitted, is simply invisible to it. Lyhna asserts only what crossed the boundary it sees; it never
assumes the rest, and never implies universal detection of work that didn't route through it.

## 2. The two repos (unchanged)

| Repo | What it is | State |
| --- | --- | --- |
| **`lyhna-mcp-proxy`** (TypeScript, base `master`) | The **MCP adapter** in the tool-call path. Witnesses real tool calls, captures agent claims, exports `witness-input.json`. On npm as `@lyhna/mcp` (`npx -y @lyhna/mcp`). | Exists, works, published. |
| **`lyhna-witness`** (zero-dep ESM, Node ≥20, base `main`) | The **deterministic engine**: labeler + receipt generator + CLI + OKF/PAM exports + capsule index + the `web/` site + the Desktop indexer & inbox CLI. | Exists, works. `main @ 862d8fb`, 170 tests green. |

The adapter **produces** `witness-input.json`; the witness **renders** it into the receipt/capsule. Lyhna
Desktop wraps **both**.

## 3. What one witnessed run produces — the Work Receipt Capsule (unchanged)

A capsule folder:

- `CAPSULE.md` + `capsule.json` — self-describing index (table of contents + trust boundaries + honesty ceiling).
- `HANDOFF.md` — the readable AI Work Receipt.
- `handoff.json` — the same receipt as machine data.
- `next-ai-prompt.md` — safe continuation handoff.
- `okf/` — OKF-style knowledge bundle (optional, `--okf`).
- `pam/` — PAM-shaped memory bundle (optional, `--pam`).
- Proof **references** live *inside* those artifacts when a signing key is attached. There is **no separate
  "proof pack" file** — do not advertise one.

Wording rules: **"PAM-shaped"** (never "PAM-compatible"), **"OKF-style"**, the **Work Receipt** is the
front-door deliverable.

## 4. The pivot — what changed (PR #48, `63e6e41`)

Reframed the public surfaces from a **hosted / metered / private-beta SaaS** story to **Lyhna Desktop:
local-first, buy-once.**

**Positioning:**
- Front door: **"Run your agents. Walk away. Come back to receipts."**
- Product: *Lyhna Desktop gives people running agents readable AI Work Receipts, backed by witnessed evidence.*
- Ownership: **Buy once · use with all your agents · unlimited local receipts · your receipts stay yours.**
- BYO: **Your agents use your keys, models, and tools. Lyhna gives you the receipts.** (Lyhna doesn't pay
  for model usage, host the work by default, or orchestrate agents.)
- Buyer: independent agent operators; local/private-AI and Ollama/local-model users; Claude Code / Codex /
  Cursor power users; consultants/agencies; small businesses that don't want another hosted cloud system.

**Buyer-surface language rules:**
- Say **"local by default"** — never **"local-only"** (cloud-hosted agents may need a remote/tunnel bridge later).
- **Killed:** "metered by witnessed action" / free tier / private-beta-as-the-main-frame /
  hosted-witness-service-as-default / plugin store / one-command install. Plus the standing kill-list —
  gate / authority / governance / judgment-ledger / binding / SDK — **even in negative phrasing** (use
  "paywalls"/"limits").
- **Signed-mode boundary stays explicit:** demo/local mode decides locally and sends nothing to Lyhna;
  **signed mode (`LYHNA_API_KEY`) routes each tool call through Lyhna's hosted witness service to decide,
  so routed args leave the machine.** Signed is an optional add-on, not the default.

**Honesty about the app itself:** Lyhna Desktop is **packaging direction, not a shipped download.** The MCP
adapter, witness CLI, and capsule exports exist today; the desktop app does **not** exist yet. Never imply
a download, and never imply that connecting auto-witnesses everything an agent does.

The website (`web/`, 5 pages — homepage / demo / install / **receipt inbox** preview / pricing) was fully
reframed to this. The old "dashboard" is the **receipt inbox** preview, clearly labeled *preview, not live
telemetry*.

## 5. What we've BUILT toward Desktop (merged on `main` — the part stale agents miss)

**Lane 1 — local capsule indexer (PR #49, `01be99a`):** [`src/capsule-indexer.mjs`](./src/capsule-indexer.mjs)
The **read model** for the desktop inbox. Pure, deterministic, zero-dep. Exports:
`indexReceiptLibrary(root, { includePartial })`, `summarizeCapsuleManifest`, `summarizeHandoff`,
`folderBaseName` (+ `INDEXER_SCHEMA = "lyhna-inbox/v0"`). Scans the immediate child folders of a receipt
library and summarizes each capsule (folder/name, objective, `safe_to_continue`, the five verdict counts,
`parent_loop_id`, `receipt_id`, `agents`, declared artifacts, missing-on-disk files, warnings). **Never
fabricates absent fields;** malformed `capsule.json` → `unreadable` entry (no crash); `handoff.json`-only
folders are a clearly-marked degraded "partial" mode; deterministic ordering (capsule timestamp parsed as
an **instant**, and only when it carries an explicit zone — else folder name; **no clock is read**);
Windows-path tolerant. Tests: [`test/desktop-inbox.test.mjs`](./test/desktop-inbox.test.mjs).

**Lane 2 — headless inbox CLI (PR #50, `862d8fb`):** [`src/inbox-cli.mjs`](./src/inbox-cli.mjs) (+ `npm run inbox`)
The usable **local inbox primitive**, before any GUI:

```bash
node src/inbox-cli.mjs <receipt-library-root>     # human-readable inbox
npm run inbox -- examples
node src/inbox-cli.mjs examples --json             # deterministic JSON, no timestamps
node src/inbox-cli.mjs examples --include-partial   # include handoff-only (degraded) folders
node src/inbox-cli.mjs examples --limit 10
node src/inbox-cli.mjs --help
```

Deterministic, no ANSI color, reads only summarized capsule fields, invalid root → nonzero exit, no
invented live adapter status. **This is the exact data contract the GUI will render over** (consume
`--json`, or import the indexer directly). Tests: [`test/inbox-cli.test.mjs`](./test/inbox-cli.test.mjs).

**Earlier website lanes (merged):** PR #43–#47 made the site capsule-first, added the dashboard/inbox
preview, and wrote the honest two-surface install; PR #48 then pivoted all of it to Desktop.

## 6. The build plan

[`DESKTOP-MVP-PLAN.md`](./DESKTOP-MVP-PLAN.md) is the source of truth for the app build. It covers reusable
engine code · missing pieces · **recommended shell: Tauri + Vite/React** · **repo placement: a separate
`lyhna-desktop` repo with `lyhna-witness` as the deterministic engine** (no GUI deps in `src/`) · local
data flow · minimal screens (Home/status, Install snippets, Receipt inbox, Receipt detail, Exports,
Settings) · local storage + indexing rules (default Windows folder
`%USERPROFILE%\Documents\Lyhna\Receipts\`) · honest test-connection design (no fake telemetry; the four
states Connected / Waiting / Test receipt created / Outside witness path) · what-not-to-build-yet · next
lanes.

## 7. What is NOT built yet (do not overclaim)

- ❌ The desktop **app** (Tauri shell, GUI) — not started; lives in a future `lyhna-desktop` repo.
- ❌ Backend, signup, billing, telemetry, cloud sync, marketplace/one-click install — none, by design.
- ❌ A real "download Lyhna Desktop" — the app isn't a download.
- ❌ `--watch` for the inbox CLI — deferred (event/time-driven; stays out of the deterministic core).
- ❌ Live adapter status in the CLI — intentionally not invented.

## 8. Next lanes (in order)

1. **Lane 3a (optional, small):** `--watch` for the inbox CLI — re-index/re-print on folder change
   (`fs.watch`, zero-dep). Ship only if it stays tiny and well-tested.
2. **Lane 3b:** the **desktop shell** in a new `lyhna-desktop` repo — Tauri + Vite/React over the
   indexer/`--json`, starting with Home/status + Receipt inbox + Receipt detail.

## 9. How we ship (every change)

One logical PR → mark ready → comment `@codex review`. **Merge only when:** all CI checks `success` +
`mergeable_state` clean + Codex "no major issues" on the *current head* + zero unresolved review threads →
**squash-merge** → reset the dev branch to base. Keep the determinism drift gates and byte-for-byte tests
green; regenerate `examples/*` + `web/data/handoff.js` via the `demo*` scripts only when you touch the
labeler/generator/receipts.

## 10. Reading order for a catching-up agent

1. This file.
2. [`LLM-CONTEXT.md`](./LLM-CONTEXT.md) — the dated single-page map (already updated for both Desktop lanes).
3. [`THESIS.md`](./THESIS.md) — canonical thesis + honesty ceiling.
4. [`AGENTS.md`](./AGENTS.md) — repo invariants.
5. [`DESKTOP-MVP-PLAN.md`](./DESKTOP-MVP-PLAN.md) — the Desktop build plan.
6. [`src/capsule-indexer.mjs`](./src/capsule-indexer.mjs) + [`src/inbox-cli.mjs`](./src/inbox-cli.mjs)
   (what's built) and [`src/capsule.mjs`](./src/capsule.mjs) (capsule shape).
7. `examples/live-loop/` and `examples/agent-team/` — the canonical capsules everything tests against.

---

**TL;DR:** We did **not** shrink Lyhna. We took the full `lyhna-witness` engine + the `@lyhna/mcp` adapter
and started packaging them as **Lyhna Desktop** — a local, buy-once receipt app. The website is already
reframed (PR #48). Two engine-side desktop primitives are merged: the **capsule indexer** (PR #49) and the
**headless inbox CLI** (PR #50). `main @ 862d8fb`, 170 tests green. The GUI itself isn't built yet — that's
the next lane, in a separate `lyhna-desktop` repo, rendering over the inbox data contract we just built.
