// Lyhna Desktop — engine path resolver (pure; deliberately electron-free).
//
// Decides where the bundled lyhna-witness engine + its data live, across three deployment shapes:
//   - dev from source:   the staged-in-repo layout  (<repoRoot>/src, /demo, /examples)
//   - packaged app:       copied into extraResources  (<resourcesPath>/engine/{src,demo,examples})
//   - explicit override:  the LYHNA_ENGINE_* env vars always win (advanced users / a future Settings pane)
//
// The engine itself is the source of truth; this module never parses receipts or re-implements any
// capsule semantics — it only resolves filesystem paths. Kept free of any `electron` import so it can be
// exercised by a plain-node/vitest harness in a headless environment, same as the other transports here.

import { join } from "node:path";

export interface EnginePathInputs {
  /** Electron's app.isPackaged — true in a built artifact, false when run from source. */
  isPackaged: boolean;
  /** process.resourcesPath in a packaged app (where extraResources land); ignored in dev. */
  resourcesPath: string | undefined;
  /** The repo root in the dev layout (…/desktop/dist-electron → …/repo). */
  repoRoot: string;
  /** process.env (or any subset) — the LYHNA_ENGINE_* overrides are read from here. */
  env: Record<string, string | undefined>;
}

export interface EnginePaths {
  /** Inbox CLI — `src/inbox-cli.mjs`. */
  engineCli: string;
  /** Witness renderer CLI — `src/cli.mjs`. */
  renderCli: string;
  /** Bundled sample render input — `demo/live-loop-witness-input.json`. */
  sampleInput: string;
  /** Bundled example capsules — `examples/`. */
  exampleLibrary: string;
}

/**
 * The directory the engine tree is rooted at when no per-path override applies: the extraResources
 * `engine/` dir in a packaged app, otherwise the repo root (dev from source).
 */
export function engineBase(i: EnginePathInputs): string {
  if (i.isPackaged && i.resourcesPath) return join(i.resourcesPath, "engine");
  return i.repoRoot;
}

/**
 * Resolve all four engine paths. Each is, independently: an explicit LYHNA_ENGINE_* override if set,
 * else derived from the engine base (packaged resources, or the repo layout in dev). Matches the env
 * var names and dev layout the shell used before bundling, so dev-from-source is unchanged.
 */
export function resolveEnginePaths(i: EnginePathInputs): EnginePaths {
  const base = engineBase(i);
  const { env } = i;
  return {
    engineCli: env.LYHNA_ENGINE_CLI ?? join(base, "src", "inbox-cli.mjs"),
    renderCli: env.LYHNA_RENDER_CLI ?? join(base, "src", "cli.mjs"),
    sampleInput: env.LYHNA_SAMPLE_INPUT ?? join(base, "demo", "live-loop-witness-input.json"),
    exampleLibrary: env.LYHNA_EXAMPLE_LIBRARY ?? join(base, "examples")
  };
}
