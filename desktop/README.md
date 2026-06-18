# Lyhna Desktop

**Run your agents. Walk away. Come back to receipts.**

Lyhna Desktop is the **local product wrapper** for Lyhna — the full
[`lyhna-witness`](../) engine plus the `@lyhna/mcp` adapter, packaged as a local app for people running
their own agents. It is **not** a smaller or separate product. The target flow (see *Status* for what’s
built today):

```
local desktop app
  → starts/controls the local MCP adapter
  → your agents route their tool calls through it
  → receipts land in a local receipt inbox
  → you open / export the capsule when you want
```

**BYO.** Your agents keep using your keys, models, tools, and workflows. Lyhna doesn’t run your models,
pay for usage, host your work by default, or orchestrate your agents. It witnesses the tool calls **routed
through it** and shows you the receipts. Intended ownership model (not purchasable yet — no pricing, no
store): *buy once, use with all your agents, unlimited local receipts, your receipts stay yours.*

**Honesty ceiling.** The app only surfaces what the receipt/capsule files already say — action-level
witnessed truth: what was claimed, what was witnessed, what was missing, what needs review. It never
implies delivery, correctness, client behavior, live witnessing, or detection of work that didn’t route
through Lyhna. A not-safe run reads as *“review before continuing,”* never as “Lyhna blocked it.”

---

## Status

This is the **v1 build in progress**, staged inside `lyhna-witness/desktop/` (see *Repo placement* below).

- **Slice 1:** Electron + Vite + React + TypeScript app frame, a thin IPC bridge, and the pure,
  unit-tested **inbox view model** (`core/inboxView.ts`).
- **Slice 2 (real inbox):** pick a receipt-library folder (or open the repo’s bundled examples), and the
  app runs the engine inbox CLI (`src/inbox-cli.mjs --json`) over it and renders the real indexed
  capsules — name, objective, verdict (*review before continuing* when not safe), the five claimed-vs-
  witnessed counts, agents, spine ids, and warning/missing-file counts. Transport (`electron/inboxSource.ts`,
  electron-free) spawns the CLI; parsing lives in `core/inboxIndex.ts` (unit-tested). The GUI re-implements
  no receipt semantics.
- **Next slices:** receipt detail, sample-receipt flow, install snippets, exports/open-folder, adapter
  status, packaging.

The desktop **app is not a public download yet.** Don’t imply one exists.

## Architecture decisions

- **Shell: Electron (for now).** Tauri is the long-term preference for a smaller native binary, but the
  current build/CI environment lacks the system `webkit2gtk` libraries Tauri’s Linux build needs, so
  Electron is the faster credible route here. To keep the door open, **all product logic lives in a
  framework-agnostic, zero-dependency core** (`core/`) and a plain Vite + React renderer (`src/`) — both
  shell-agnostic — so swapping the shell to Tauri later does not touch the product logic.
- **Engine stays the engine.** The GUI never re-implements receipt/capsule semantics. It consumes the
  `lyhna-witness` indexer / `inbox-cli.mjs --json` contract (`lyhna-inbox/v0`). All trust labels, verdicts,
  and capsule shape remain owned by the deterministic engine.
- **Repo placement.** The desktop app should live in its own `lyhna-desktop` repo with `lyhna-witness` as a
  dependency. It is staged here for now because that repo was not creatable from the current environment;
  it is a self-contained subproject (own `package.json`/`node_modules`) that does not affect the engine’s
  zero-dependency posture, and it can be extracted with `git subtree split` when the repo exists.

## Run it

Requires Node ≥ 20. From `desktop/`:

```sh
npm install

# Fast renderer iteration in a browser (no Electron window):
npm run dev            # Vite dev server

# Type-check everything (renderer + core + Electron main/preload):
npm run typecheck

# Build the renderer bundle:
npm run build

# Unit-test the core view model:
npm test

# Full desktop run (builds renderer + Electron main, then launches the window):
npm start
```

> **Headless note.** `npm start` opens a real OS window and needs a display; it can’t run in a headless
> CI/sandbox. In such environments, `npm install`, `npm run typecheck`, `npm run build`, and `npm test`
> are the verification path, and the window launch is done on a machine with a display.

## Layout

```
desktop/
  electron/        thin Electron shell (main + preload); no product logic
  core/            pure, zero-dep view model over the engine's inbox JSON (unit-tested)
  src/             Vite + React + TypeScript renderer (the app frame + screens)
  index.html       renderer entry
  vite.config.ts   renderer build (base "./" for file:// loading in Electron)
```
