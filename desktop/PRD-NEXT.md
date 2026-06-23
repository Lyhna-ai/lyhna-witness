# Lyhna Desktop — PRD for the next phase ("v1 in-repo → shippable local product")

> **Read [`../HANDOFF-DESKTOP.md`](../HANDOFF-DESKTOP.md) first.** This PRD assumes that context.
> **Status going in:** `lyhna-witness main @ 7c89cd7`. Lyhna Desktop v1 is built in-repo (`desktop/`,
> Electron + Vite/React over a tested zero-dep core) and runs from source; it is **not** yet a
> shippable/downloadable product. Engine suite 170 (`node --test`); desktop suite 57 (`vitest`, gated by
> `.github/workflows/desktop.yml`).

## 1. Goal

Turn the working in-repo v1 into a **shippable, owned, local product**: a user can install Lyhna Desktop,
point it at (or let it create) a receipt library, connect an agent through the MCP adapter, and come back
to readable receipts — **without cloning the repo**, and without Lyhna ever overclaiming.

Success for this phase = the **honest blockers** in HANDOFF §7 are cleared in priority order, each shipped
as a gated PR, with the honesty ceiling intact.

## 2. Non-goals (do not build)

- No backend, accounts, signup, billing, telemetry, cloud sync, or marketplace.
- No fake **"Connected"** adapter status, no fake download, no fake live witnessing.
- No change to **receipt/capsule semantics, signing, canonicalization, or the verifier** (engine `src/`
  stays deterministic — no clock/randomness/model calls; the drift gates enforce it).
- No buyer-surface kill-list language (HANDOFF §4), even in negation.
- Do **not** turn Lyhna into an agent orchestrator. It witnesses calls routed through it; nothing else.
- No pricing numbers until the owner approves them.

## 3. Hard constraints / invariants (carry into every PR)

- **Honesty ceiling:** action-level witnessed truth only. A not-safe run reads **"review before
  continuing,"** never "blocked." Samples are always labeled samples. Signed mode discloses that routed
  args leave the machine; demo/local sends nothing to Lyhna. "local by default," never "local-only."
- **Engine is the source of truth.** The GUI renders engine output; it must not re-implement trust labels,
  verdicts, or capsule shape. Keep all GUI product logic in `desktop/core/` (pure, vitest-tested) with the
  Electron main as a thin shell.
- **Headless-safe verification.** CI (`desktop.yml`) runs typecheck + vitest + vite build + electron tsc;
  anything needing a display or the Electron binary is verified manually and documented, not faked.
- **Ship discipline:** one logical PR per slice → mark ready → `@codex review` → merge only when engine
  `test` + `desktop` CI are green, mergeable clean, Codex "no major issues" on the head, threads resolved →
  squash-merge → reset branch. Reviewer subagent for any UX/copy.

## 4. Epics (priority order)

### Epic A — Bundle the engine so a packaged app runs without the repo  **[P0, the #1 blocker]**
*Why:* `electron-builder` already produces artifacts, but the packaged app resolves the engine via the
in-repo layout / `LYHNA_ENGINE_*` env (`desktop/electron/main.ts`), so it won't find the engine on a clean
machine. Until this is solved, a "download" is meaningless.

*Scope:*
- Ship the engine **inside** the packaged app: the zero-dep ESM under `src/` (at least `cli.mjs`,
  `inbox-cli.mjs`, and their imports), plus `demo/live-loop-witness-input.json` and the `examples/` used by
  "Open bundled examples". Use electron-builder `extraResources` (or copy into the build) and resolve paths
  from `process.resourcesPath` in production, falling back to the repo layout in dev and to the existing
  `LYHNA_ENGINE_*` env overrides.
- Confirm the spawn model works packaged: the transports use `process.execPath` + `ELECTRON_RUN_AS_NODE=1`
  to run `.mjs` engine files. Verify that runs against the bundled engine in a packaged build (no system
  `node` assumed).
- Decide + document how the engine source is vendored into `desktop/` for packaging (copy step in
  `pack`/`dist`, a prepack script, or a git submodule once extracted — see Epic B).

*Acceptance:*
- `npm run pack` produces an app directory that, with `LYHNA_ENGINE_*` **unset** and the repo absent from
  the runtime path, can: open the bundled examples, render a sample receipt, and open a receipt's detail.
- A pure unit test covers the production-vs-dev engine-path resolver (inject `resourcesPath`/env, assert
  the chosen path) in `desktop/core/`.
- Honesty: only claim a "download/installer" once a built artifact actually runs standalone; update
  `desktop/README.md` + `LLM-CONTEXT.md` to match (today they correctly say no download exists).

### Epic B — Extract to a standalone `lyhna-desktop` repo  **[P0, needs OWNER action]**
*Why:* the desktop app is staged in `lyhna-witness/desktop/` only because the repo wasn't creatable in the
build session; the intended home is its own repo with `lyhna-witness` as the engine dependency.

*Scope / acceptance:*
- **Owner decision required:** create the `lyhna-desktop` GitHub repo (and add it to the agent's repo
  scope). Until then, keep working in-repo.
- Extract `desktop/` via `git subtree split` preserving history; wire `lyhna-witness` as a dependency
  (git submodule pinned to a tag, or a published `@lyhna/*` package once the engine is packable).
- Port `desktop.yml` CI to the new repo; the in-repo `desktop/` is removed from `lyhna-witness` in the same
  change (or left as a thin pointer). Acceptance: new repo builds + CI green; nothing in `lyhna-witness`
  still depends on `desktop/`.

### Epic C — Settings pane  **[P1]**
*Why:* the library path (and engine/adapter overrides) are chosen every session; users want it remembered.

*Scope:* a Settings screen + persisted local config (Electron `app.getPath('userData')`/JSON): default +
remembered **receipt library path**, optional engine/adapter path overrides, and a **signed-mode
disclosure** (key presence + the "routed args leave your machine" note — never store/transmit the key
silently). On launch, the inbox opens the remembered library.

*Acceptance:* settings persist across launches; a pure `desktop/core/settings.ts` (schema + load/merge/
validate) is unit-tested; no secret is logged or sent anywhere; copy passes a reviewer-subagent honesty
pass.

### Epic D — Live adapter management + honest real status  **[P1]**
*Why:* the Adapter panel currently shows only a library-derived signal and explicitly can't show
"Connected." Make it real **without faking**.

*Scope:* optionally start/stop the local `@lyhna/mcp` adapter from the app and supervise the process;
derive the four states from **real** signals (process up? any witnessed call observed? a receipt created?).
Show **"Connected" only when actually verified** (e.g., a witnessed call/receipt observed) — otherwise keep
Waiting / Not-connected. Reuse the existing honest legend.

*Acceptance:* states map to real process + receipt-activity signals; no green without verification; the
state machine is pure + unit-tested in `desktop/core/`; if real start/stop isn't reliably testable, keep it
as guidance (do not fake), and document why.

### Epic E — On-display visual QA + polish  **[P1]**
*Why:* no slice has been seen in a real window (headless sandbox).

*Scope/acceptance:* run the app on a machine with a display; capture real screenshots of inbox + detail +
install + adapter; fix layout/contrast/keyboard-nav issues found; add the screenshots to `desktop/README.md`.
(If the executing environment is still headless, say so and leave this for an environment with a display —
do not fake screenshots.)

### Epic F — Optional add-ons  **[P2, only if real]**
Inbox auto-refresh (`fs.watch`, kept out of the deterministic core — only the printed/rendered snapshot is
deterministic); receipt-signing UI (optional add-on that discloses hosted egress); packaging
code-signing/notarization (needs OWNER certs/secrets — do not attempt without them).

## 5. Open questions for the owner (Adam)

1. **Create the `lyhna-desktop` repo?** (Blocks Epic B; otherwise we keep building in-repo.)
2. **Engine vendoring for packaging:** submodule vs. publishing the engine as an npm package vs. a copy
   step. (Affects A + B.)
3. **Tauri revisit?** Electron was chosen because the build env lacked `webkit2gtk`; the core/renderer are
   shell-agnostic, so a Tauri swap is low-cost if a smaller binary matters. Decide before investing in
   Electron-specific packaging/signing.
4. **Pricing numbers / purchase path** — still held; PRD assumes "buy once" model copy only, no numbers.
5. **Code-signing/notarization certs** (Apple/Windows) — owner-provided secrets; needed for a trusted
   installer.

## 6. Suggested sequence

A (engine bundling) → C (settings) → D (adapter status, real) → E (visual QA) → B (repo extraction, when
the repo exists) → F (add-ons). A is the gating unlock for a real download; B can slot in whenever the
owner creates the repo.

## 7. Definition of done (phase)

A user on a clean machine can install Lyhna Desktop, have it remember their receipt library, connect an
agent via the install snippets, and read receipts in the inbox/detail — with the adapter panel showing
honest real status — and **every surface still passes the honesty ceiling** (no fake connected/download/
delivery claims, samples labeled, signed-mode egress disclosed). Engine + desktop CI green; reviewer-
subagent clean on copy.
