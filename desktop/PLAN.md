# PLAN — Epic A: make the packaged Lyhna Desktop app run without the repo

> Scope is **`lyhna-witness/desktop/`** only. No new repo, no npm publish, no submodule. Electron, not
> Tauri. No new product surface. No change to receipt/capsule semantics, signing, canonicalization,
> labels, verifier, or determinism. One logical PR.

## 1. Root cause (why a packaged build breaks on a clean machine)

`desktop/electron/main.ts` resolves every engine/data path from the in-repo layout:

```ts
const repoRoot     = join(here, "..", "..");                 // dist-electron → desktop → repo
const engineCli    = env.LYHNA_ENGINE_CLI     ?? join(repoRoot, "src", "inbox-cli.mjs");
const exampleLibrary = env.LYHNA_EXAMPLE_LIBRARY ?? join(repoRoot, "examples");
const renderCli    = env.LYHNA_RENDER_CLI     ?? join(repoRoot, "src", "cli.mjs");
const sampleInput  = env.LYHNA_SAMPLE_INPUT   ?? join(repoRoot, "demo", "live-loop-witness-input.json");
```

In a packaged app `here` is inside `…/resources/app.asar/dist-electron`, so `../../` is **not** the repo
— `src/`, `examples/`, `demo/` are absent. The only escape today is the `LYHNA_ENGINE_*` env overrides,
and a clean install has none. **The runtime gap is purely (a) the engine files aren't shipped and (b) the
paths aren't resolved for the packaged layout.**

The spawn model is already correct: both transports spawn `process.execPath` with
`ELECTRON_RUN_AS_NODE=1` (`electron/inboxSource.ts`, `electron/sampleSource.ts`), so the engine runs on
the **Electron binary as Node** — *no system `node` is required*. Epic A must not regress that.

## 2. What must be bundled (verified by recon + direct grep)

- **Engine import closure — 10 `.mjs`, all under `src/`, zero deps (only `node:fs`, `node:path`):**
  `cli.mjs` → `witnessed-event.mjs`, `generate.mjs`, `okf.mjs`, `pam.mjs`, `capsule.mjs`;
  `witnessed-event.mjs` → `contract.mjs`; `generate.mjs` → `labels.mjs`, `contract.mjs`;
  `inbox-cli.mjs` → `capsule-indexer.mjs`. No dynamic imports, no bare deps, **no upward/repo-relative
  file reads** (every read is a user-supplied path). We will copy the whole `src/` (cheap, future-proof).
- **`demo/live-loop-witness-input.json`** (sample render input).
- **`examples/`** (~408 KB; capsules contain `CAPSULE.md`, `capsule.json`, `HANDOFF.md`, `handoff.json`,
  `okf/`, `pam/`) — what "Open bundled examples" + receipt detail read.

Because the engine is zero-dep and never walks to a repo root, a **plain copy into the bundle is provably
sufficient** — the fence's "unless you prove the copy/bundle path can't work" is satisfied; no submodule
or npm publish is warranted.

## 3. Design

### 3a. Bundle via `extraResources`, engine OUTSIDE the asar
Spawned `.mjs` must be real files on disk (a child Node process can't traverse `app.asar`). So ship the
engine in **`extraResources`**, which land under `process.resourcesPath` *outside* the archive.

- New `desktop/scripts/stage-engine.mjs`: copies `../src` → `build/engine/src`, `../demo` →
  `build/engine/demo`, `../examples` → `build/engine/examples`. `build/` is **gitignored** (no committed
  duplication → no engine drift-gate conflict). Single source of truth for both packaging and the smoke
  check.
- `package.json` `build.extraResources`: `[{ "from": "build/engine", "to": "engine" }]`.
- `pack`/`dist` run `stage-engine` first.

Packaged layout → `…/resources/engine/{src,demo,examples}/…`.

### 3a-bis. Bundled examples must be writable (read-only install dirs)
`resources/engine/examples` lives under the install dir, which is **read-only/admin-owned** on real
packaged installs (AppImage mount, `/Applications`, `Program Files`). But the renderer makes the
"Open bundled examples" path the *active library*, and "Create sample receipt" writes into the active
library — so opening examples then creating a sample would fail on a real install (the `linux-unpacked`
`--dir` build wouldn't catch it because that dir is writable). **Fix:** when packaged, the
`lyhna:exampleLibraryPath` handler materializes the bundled examples into a writable per-user copy
(`app.getPath("userData")/bundled-examples`, idempotent: copy only if absent) and returns *that* path.
The renderer is unchanged; inbox reads, sample creation, and detail then all work because the active
library is writable. In dev (not packaged) it returns the repo `examples/` dir as today. The copy helper
(`electron/exampleLibrary.ts`) is pure over its path args and vitest-tested; the DONE gate chmods the
packaged examples resource to read-only to actually exercise the install case.

### 3b. Pure prod-vs-dev resolver — in `desktop/electron/` (not `core/`)
> **Plan change (Codex P1):** the PRD suggested `core/`, but `tsconfig.electron.json` has
> `rootDir: "electron"` / `include: ["electron"]`, so a `../core/…` import from `electron/main.ts` is
> outside `rootDir` and fails the Electron typecheck; widening `rootDir` would also change the emitted
> `dist-electron` layout (breaking `main`/preload paths). The resolver is **transport plumbing** (where the
> engine binary + data live), not trust/receipt semantics, so its correct home is `electron/` alongside the
> existing electron-free, vitest-tested transports (`inboxSource`/`sampleSource`/`receiptSource`). It stays
> pure and unit-tested — satisfying the acceptance intent without crossing the compile boundary.

New `desktop/electron/enginePaths.ts` (pure, **no `electron` import**):

```ts
resolveEnginePaths({ isPackaged, resourcesPath, repoRoot, env }) =>
  { engineCli, renderCli, sampleInput, exampleLibrary }
```

Per-path resolution order: **explicit `LYHNA_ENGINE_*` env override → packaged base
(`resourcesPath/engine`) when `isPackaged` → dev repo layout (`repoRoot`).** Keeps existing env overrides
working (Settings pane, advanced users) and the dev-from-source path unchanged.

`main.ts` becomes a thin caller: pass `app.isPackaged`, `process.resourcesPath`,
`repoRoot = join(here,"..","..")`, `process.env`. No other behavior changes.

### 3c. Tests
- **Unit (`electron/enginePaths.spec.ts`, vitest, runs in CI):** inject combinations and assert the chosen
  path for each of the four entries — (i) dev (not packaged) → repo layout; (ii) packaged → `resourcesPath/
  engine/…`; (iii) each env override wins in both modes. This is the required prod-vs-dev resolver test.
- **Unit (`electron/exampleLibrary.spec.ts`, vitest):** packaged → copies bundled examples into the
  writable userData path and returns it; idempotent (no clobber if already present); dev → returns the
  repo examples dir unchanged.
- **Build-time smoke (`scripts/smoke-engine.mjs`, plain `node`, runs in CI):** stage the engine, then
  spawn the **staged** `inbox-cli.mjs` over the **staged** `examples/` (`--json`) and assert exit 0 +
  parseable `lyhna-inbox/v0` + ≥1 entry; spawn the **staged** `cli.mjs` on the **staged** demo input into
  a temp dir and assert exit 0 + a `capsule.json` written; read it back. **Fails loudly if any engine
  module won't resolve** — catching a missing transitive import before it ships. Wire as `npm run smoke`
  and add a step to `.github/workflows/desktop.yml`.

## 4. The DONE gate (run it, show the output — don't assert it)

Build, then exercise the packaged artifact on a profile with **no repo present, no system `node` on PATH,
and `LYHNA_ENGINE_CLI` / `LYHNA_RENDER_CLI` / `LYHNA_SAMPLE_INPUT` / `LYHNA_EXAMPLE_LIBRARY` all unset.**

1. `npm run pack` → `release/linux-unpacked/`.
2. Copy `linux-unpacked` to a temp dir **outside the repo**; clean `HOME`; `PATH` scrubbed of any `node`;
   all `LYHNA_ENGINE_*` unset.
   To exercise the **read-only install** case (3a-bis) the packaged `resources/engine/examples` dir is
   chmod'd read-only before the run, so a failure to redirect sample creation to userData would surface.
3. **(a) Real GUI boot** under `xvfb-run`: launch the packaged binary, confirm it boots and the renderer
   loads with no crash (proves it runs standalone with no repo/node).
4. **(b) Packaged-engine end-to-end** using the **packaged Electron binary as Node**
   (`ELECTRON_RUN_AS_NODE=1`, no system `node` on PATH), driving the exact prod resolver + transports
   against the bundled resources: **open bundled examples** (`runInbox` over `resources/engine/examples`),
   **render a sample receipt** (`renderSample` of the bundled demo input into a temp library), **open
   receipt detail** (`readReceipt` of the rendered capsule). Print stdout.
   - If driving the real React UI headlessly via the Electron remote-debugging CDP proves reliable, do the
     three clicks in the actual window instead; otherwise (a)+(b) together cover the gate's two target
     failures (missing transitive import; shelling to an absent `node`). **Report exactly what was
     verified mechanically vs. via the GUI — no overclaim.**

CI keeps its current posture (no electron-builder in CI); the packaged gate is run here and its output
pasted into the PR.

## 5. Honesty / docs
- Update `desktop/README.md` "Build & package" + Status: the engine **is** bundled (`extraResources`) and
  resolved from `resourcesPath` in prod, repo layout in dev, env override always. Only state that a
  standalone artifact **runs** — backed by the pasted gate output. **No claim of a public download/
  installer** (none is published; signing/notarization still owner-blocked).
- Update `LLM-CONTEXT.md` desktop status line to match (engine-bundling blocker cleared; still no
  published download).

## 6. Files touched
- `desktop/electron/main.ts` — call resolver + materialize examples to userData when packaged (thin).
- `desktop/electron/enginePaths.ts` + `desktop/electron/enginePaths.spec.ts` — new, pure + tested.
- `desktop/electron/exampleLibrary.ts` + `desktop/electron/exampleLibrary.spec.ts` — new, pure + tested.
- `desktop/scripts/stage-engine.mjs`, `desktop/scripts/smoke-engine.mjs` — new.
- `desktop/package.json` — `extraResources`, `stage`/`smoke` scripts, `pack`/`dist` stage first.
- `desktop/.gitignore` — ignore `build/`.
- `.github/workflows/desktop.yml` — add `npm run smoke`.
- `desktop/README.md`, `LLM-CONTEXT.md` — honest packaging state.

## 7. Out of scope / invariants held
No engine `src/` edits (semantics/determinism untouched). No Settings/billing/telemetry/live-control
surface. No Tauri. No new repo/submodule/publish. One logical PR; merge only when engine `test` +
`desktop` CI green, Codex clean on HEAD, threads resolved.
