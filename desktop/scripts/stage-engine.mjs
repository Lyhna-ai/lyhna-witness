#!/usr/bin/env node
// Lyhna Desktop — stage the witness engine for bundling.
//
// Copies the engine source + the data the desktop app needs (the demo render input and the example
// capsules) from the repo into `desktop/build/engine/`, which electron-builder ships as `extraResources`
// (outside the asar, so the spawned `.mjs` resolve as real files on disk). `build/` is gitignored — this
// is the single source of truth for packaging, with no committed duplication of the engine. Run before
// `pack`/`dist` and before the build-time smoke check.
//
// The engine is zero-dependency (only node: builtins) and does no repo-relative file reads, so a plain
// copy is sufficient — no submodule or npm publish is needed to bundle it.

import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // desktop/scripts
const desktopRoot = join(here, "..");                 // desktop
const repoRoot = join(desktopRoot, "..");             // repo root (engine lives here)

/** The engine pieces to bundle: <name under build/engine> ← <source dir in the repo>. */
const PARTS = [
  ["src", join(repoRoot, "src")],
  ["demo", join(repoRoot, "demo")],
  ["examples", join(repoRoot, "examples")]
];

/**
 * Copy the engine into desktop/build/engine/ and return the staged paths. Idempotent — the destination
 * is wiped and rewritten each run so staging always matches the current repo.
 */
export function stageEngine() {
  const engineDir = join(desktopRoot, "build", "engine");
  for (const [, srcPath] of PARTS) {
    if (!existsSync(srcPath)) {
      throw new Error(`stage-engine: missing engine source ${srcPath} — run from within the repo`);
    }
  }
  rmSync(engineDir, { recursive: true, force: true });
  mkdirSync(engineDir, { recursive: true });
  for (const [name, srcPath] of PARTS) {
    cpSync(srcPath, join(engineDir, name), { recursive: true });
  }
  return {
    engineDir,
    engineCli: join(engineDir, "src", "inbox-cli.mjs"),
    renderCli: join(engineDir, "src", "cli.mjs"),
    sampleInput: join(engineDir, "demo", "live-loop-witness-input.json"),
    exampleLibrary: join(engineDir, "examples")
  };
}

// Run directly: `node scripts/stage-engine.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { engineDir } = stageEngine();
  console.log(`stage-engine: staged engine → ${engineDir}`);
}
