# Lyhna Desktop — MVP Plan

> **Status (2026-06-18):** **Lyhna Desktop v1 (in-repo) is feature-complete.** Engine-side primitives plus
> a runnable Electron + Vite/React app live under `desktop/`. Shipped:
> - **Lane 1 — local capsule indexer** (`src/capsule-indexer.mjs`): the read model over capsule folders.
> - **Lane 2 — headless inbox CLI** (`src/inbox-cli.mjs`, `npm run inbox`): the local inbox primitive.
> - **Desktop app (`desktop/`)** — Slice 1 scaffold (Electron + Vite/React + tested zero-dep core) ·
>   Slice 2 real receipt inbox (folder picker → engine CLI → rows) · Slice 3 receipt detail (HANDOFF.md +
>   claimed-vs-witnessed + artifacts) · Slice 4 sample-receipt flow (labeled sample) · Slice 5 install
>   snippets (Claude Code/Codex/Cursor/Hermes/generic) · Slice 6 exports/open-folder · Slice 7 honest
>   adapter status · Slice 8 packaging config (electron-builder) + docs. See `desktop/README.md`.
> - **Still deferred (honest):** a real standalone installer (needs the engine **bundled** into the app —
>   today it locates the sibling engine via repo layout / `LYHNA_ENGINE_*` env), live adapter
>   start/stop+detection, receipt-signing UI, a Settings pane, extraction to a standalone `lyhna-desktop`
>   repo, and on-display visual QA. No prebuilt download, billing, signup, telemetry, or cloud sync.
>
> Honesty boundaries that bind every screen and every claim below:
> - Lyhna Desktop **exists in-repo and runs from source** (`desktop/`), but is **not a shipped/downloadable
>   product** — there is no prebuilt installer (see §8 packaging for the engine-bundling blocker).
> - The **MCP adapter exists** (`@lyhna/mcp` on npm); the **witness CLI exists** (`node src/cli.mjs`);
>   the **capsule exports exist** (`CAPSULE.md` / `capsule.json` / `HANDOFF.md` / `handoff.json` /
>   `next-ai-prompt.md` / optional `okf/` / `pam/`). The **desktop app runs from source today** (`desktop/`)
>   but is **not yet a standalone download.**
> - An agent is **witnessed only when its tool calls route through Lyhna** — never imply that connecting
>   the app automatically witnesses everything an agent does.
> - **Local by default** (not "local-only"): cloud-hosted agents may need a remote/tunnel bridge later.
> - Preserve **OKF-style / PAM-shaped** wording and the **Work Receipt** as the front-door output. The
>   app indexes and displays what the capsule says; it **never invents facts**.

---

> **Reading note (sections 1–10 are the ORIGINAL plan, pre-implementation).** They are kept for rationale
> and history — the decisions, screen list, and storage/indexing rules still describe how the app is
> built. But where a section says something is "missing", "not added yet", or "not built" (e.g. §2 missing
> pieces, §3 "no Tauri/Electron dependency is added", §9 what-not-to-build-yet), that reflects the state
> *before* the slices landed. **Current status is the status block above + [`desktop/README.md`](./desktop/README.md):**
> Lyhna Desktop v1 is built in-repo (Electron + Vite/React under `desktop/`); what remains is a standalone
> installer (engine bundling), live adapter management, signing UI, Settings, and repo extraction.

## 1. Existing reusable code (the engine is already here)

`lyhna-witness` is the deterministic engine; the desktop app is a thin local shell over it.

- **Capsule shape + manifest** — `src/capsule.mjs` (`renderCapsule`, `CAPSULE_SCHEMA = "lyhna-capsule/v1"`).
  Defines the artifact set, trust boundaries, and the honesty ceiling carried in every `capsule.json`.
- **Receipt generation** — `src/generate.mjs` (handoff/receipt), `src/labels.mjs` (deterministic trust
  labels), `src/witnessed-event.mjs` (proxy events → labeler input), `src/contract.mjs` (the claim spine:
  `parent_loop_id`, `receipt_id`, `agents[]`).
- **Carrier exports** — `src/okf.mjs` (OKF knowledge bundle), `src/pam.mjs` (PAM-shaped memory bundle).
- **CLI** — `src/cli.mjs`: `node src/cli.mjs <witness-input.json> [outDir] [--gate] [--okf] [--pam]`.
  Writes a full capsule folder. This is the renderer the desktop app would call (or wrap) for "render a
  sample receipt."
- **Canonical fixtures** — `examples/live-loop/` (plain capsule) and `examples/agent-team/` (capsule with
  the run spine + subagent attribution). The indexer and future inbox UI test against these.
- **`src/capsule-indexer.mjs`** (lane 1) — `indexReceiptLibrary(root, { includePartial })` returns a
  deterministic, compact inbox summary per capsule folder (verdict, counts, spine, agents, artifacts,
  missing files, warnings). Pure summarizers `summarizeCapsuleManifest` / `summarizeHandoff` are exported
  for reuse. This is the **read model** behind the receipt inbox.
- **`src/inbox-cli.mjs`** (lane 2) — the headless **inbox primitive**: `node src/inbox-cli.mjs <root>`
  (or `npm run inbox -- <root>`) prints the inbox deterministically as text or `--json`, with
  `--include-partial` / `--limit <n>` / `--help`. No GUI, no color, no clock. The desktop inbox screen
  is a renderer over this exact data; until the GUI exists, this is the usable, CI-tested inbox.

## 2. Missing pieces (what the desktop app still needs)

- A **desktop shell** (window, navigation, file-system access scoped to a chosen receipt folder).
- A way to **start/stop and observe the local MCP adapter** from the app (process supervision + status).
- **Install-snippet UX** (copy-paste `.mcp.json` blocks; the same honest two-surface story as the website).
- **Receipt detail rendering** (render `HANDOFF.md` / `CAPSULE.md`; show per-step claimed-vs-witnessed).
- **Folder watching** so the inbox refreshes when a new capsule lands (the indexer is the read; a watcher
  is the trigger).
- **Settings persistence** (chosen receipt folder, partial-mode on/off).
- Packaging/signing for distribution (later — not part of proving the first buyer moment).

## 3. Recommended shell: Tauri + Vite/React

**Recommendation: Tauri (Rust core) + a Vite + React/TypeScript front end.**

Reasoning:
- **Small, native, local-first.** Tauri ships a tiny binary using the OS webview instead of bundling
  Chromium (Electron). For a *local* receipt app that mostly reads files, that footprint and the native
  file-system/process APIs fit the "a local app you own" promise far better than a heavyweight runtime.
- **Right trust posture.** Tauri's capability/allow-list model keeps file-system and shell access narrow
  and explicit — appropriate for an app whose whole pitch is honesty and staying on the user's machine.
- **Reuse the engine as-is.** The deterministic logic stays in `lyhna-witness` (Node/JS). The Tauri app
  invokes it as a child process (the CLI) and/or ports the pure, zero-dep indexer to run in the webview —
  no rewrite of receipt semantics.
- **Vite + React/TS** gives a fast iteration loop and a typed UI over the indexer's stable entry shape.

Trade-off noted honestly: Tauri needs a Rust toolchain and per-OS webview quirks exist. If that friction
blocks the first Windows build, Electron is the fallback — but the default is Tauri. **No Tauri/Electron
dependency is added in this PR**; this is the planned shell, not a started one.

## 4. Recommended repo placement

**Keep the desktop app in its own repo; keep `lyhna-witness` as the deterministic engine.**

- `lyhna-witness` stays a zero-dependency, deterministic library + CLI (the drift gates and byte-for-byte
  tests depend on that purity — a desktop GUI must not leak a clock, randomness, or UI deps into `src/`).
- A new repo (e.g. `lyhna-desktop`) holds the Tauri shell and depends on `lyhna-witness` as the engine
  (vendored, submodule, or published package) — never the reverse.
- The **indexer lives in `lyhna-witness`** on purpose: it is pure, deterministic, and engine-shaped, so it
  belongs with the engine and can be tested against the canonical `examples/` fixtures here. The desktop
  repo consumes it.

## 5. Local data flow

```
agent (your keys/models/tools)
   │  tool calls
   ▼
local Lyhna MCP adapter  (npx -y @lyhna/mcp)   ← witnesses only calls routed through it
   │  witnessed run → export-pack → witness-input.json
   ▼
witness CLI (node src/cli.mjs …)               ← renders the capsule folder
   │  writes CAPSULE.md / capsule.json / HANDOFF.md / handoff.json / next-ai-prompt.md / okf/ / pam/
   ▼
receipt library folder  (one subfolder per capsule)
   │  read-only scan
   ▼
desktop receipt inbox   (src/capsule-indexer.mjs → inbox entries)
```

Everything left of the receipt library is the existing engine. The desktop app owns only the last step:
**read the folder, summarize what the capsule files say, display it.** No network, no fabrication.

## 6. Minimal screens

1. **Home / status** — is the local adapter running? where is the receipt folder? how many receipts,
   how many flagged (unsupported / DO-NOT-SEND)? Honest empty state when nothing is connected yet.
2. **Install snippets** — copy-paste the `.mcp.json` adapter block (the website's two-surface story:
   quick-connect stdio vs. the standing-service capsule flow). States plainly what works today.
3. **Receipt inbox** — the list view over `indexReceiptLibrary`: per capsule, the objective, verdict
   (safe-to-continue), counts, agents, and any warnings. Sorted deterministically.
4. **Receipt detail** — render one capsule: `HANDOFF.md` (the readable receipt) front and center, the
   per-step claimed-vs-witnessed table, the spine/agent attribution, and links to the raw artifacts.
5. **Exports** — show/open the capsule's artifacts (`okf/`, `pam/`, JSON) and reveal-in-folder; "copy
   receipt" for the audit-your-own-AI dare. Export is opening what already exists — nothing new asserted.
6. **Settings** — choose the receipt-library folder, toggle degraded (handoff-only) indexing, adapter
   path/env. Local only; no account.

## 7. Local storage design

- **Default receipt folder (Windows):** `%USERPROFILE%\Documents\Lyhna\Receipts\` (configurable in
  Settings). macOS/Linux analogues: `~/Documents/Lyhna/Receipts/`. The app reads this root; the user owns
  it.
- **Capsule folder layout (one folder per witnessed run):**
  ```
  <receipt-library>/
    <capsule-name>/
      CAPSULE.md          capsule.json        ← index pair (capsule-index trust boundary)
      HANDOFF.md          handoff.json        ← the AI Work Receipt (witnessed-receipt)
      next-ai-prompt.md                       ← continuation (witnessed-continuation)
      okf/                pam/    (optional)  ← OKF-style / PAM-shaped carriers (carrier-projection)
  ```
- **Indexing rules (as implemented in `src/capsule-indexer.mjs`):**
  - Scan the **immediate child folders** of the receipt root only (one level).
  - A **valid capsule** is a folder containing `capsule.json`; parse it and summarize.
  - **Degraded mode** (`includePartial`, default on): a folder with `handoff.json` but no `capsule.json`
    is indexed as a `partial` entry and **clearly marked "not a full capsule."**
  - A folder with **neither** is ignored (not a receipt).
  - **Malformed `capsule.json` → an `unreadable` entry with a warning, never a crash.**
  - **Never fabricate** absent fields (`receipt_id`, `parent_loop_id`, `agents`, counts) — absent is
    reported as `null`/empty.
  - Flag **declared-but-missing artifact files** in `missing_files` + a warning.
  - **Deterministic order:** newest first by the capsule's embedded `timestamp` when present (no clock is
    read), otherwise by folder name. Tolerates Windows-style paths.

## 8. Test-connection design

- **Render a sample receipt** — run the witness CLI against the bundled
  `demo/live-loop-witness-input.json` into a temp folder and show the resulting capsule in the inbox.
  Proves the renderer works end to end **without** needing a live agent. (Mirrors install Step 1.)
- **Adapter smoke status** — report whether the local MCP adapter process is reachable and whether any
  calls have been **witnessed** yet. Surface the same four honest states the website defines: Connected /
  Waiting for first witnessed tool call / Test receipt created / Not connected · outside the witness path.
- **No fake telemetry.** Status is derived only from the local process and the local files: an adapter
  that is up but has witnessed nothing reads as *waiting*, never as a green "all good." An agent whose
  calls don't route through Lyhna reads as *outside the witness path*, never as silently fine.

## 9. What NOT to build yet

- No Tauri/Electron shell in **this** PR (this lane is the indexer proof + plan only).
- No backend, signup, billing, telemetry, cloud sync, marketplace/one-click install, or agent
  orchestration.
- No change to receipt semantics, the labeler/generator, the capsule shape, or the proof spine.
- No fake desktop download or "install Lyhna Desktop" button on the website until a build is real.
- No implication that connecting the app witnesses agents automatically.

## 10. Next implementation PR (after this one)

Lane 2 (the headless inbox CLI) is **landed** — `src/inbox-cli.mjs` + `npm run inbox`, with text/JSON
output, `--include-partial`, `--limit`, and `--help`, gated by `test/inbox-cli.test.mjs`. Candidates for
the next lane, in order of preference:

- **Lane 3a — `--watch` (optional, small):** re-index and re-print on folder change (zero-dep `fs.watch`),
  so a terminal user sees new receipts land. Deferred from lane 2 to keep that PR small and because a
  watch loop is inherently time/event-driven (it must stay out of the deterministic core; only the
  *printed snapshot* is deterministic). Ship only if it stays tiny and well-tested.
- **Lane 3b — the desktop shell:** in the separate `lyhna-desktop` repo, Tauri + Vite/React over this
  exact indexer/CLI, starting with the Home/status + Receipt inbox + Receipt detail screens.

Either way the engine-side contract is now stable: the GUI consumes `--json` (or imports the indexer
directly); it does not re-implement capsule parsing.
