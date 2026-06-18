// Lyhna Desktop — sample receipt renderer (node-only transport; electron-free).
//
// Runs the real lyhna-witness CLI on the BUNDLED DEMO input to render a real capsule into the user's
// library, so they can see the inbox + detail working end to end. It is sample data — a demo input
// rendered by the real engine — NOT a live witnessed run, and it fakes no routed tool call. The UI labels
// it as a sample; the folder name makes it unmistakable on disk. Electron-free so it's headlessly testable.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Keep in sync with core/sample.ts SAMPLE_FOLDER_NAME (the renderer can't import this node-only module).
export const SAMPLE_FOLDER_NAME = "lyhna-sample-receipt";

/**
 * Atomically reserve an unused sample folder in the library and return its path. Uses an exclusive
 * (non-recursive) mkdir so the create is never destructive AND two near-simultaneous creates (e.g. a
 * double-click) can't both claim the same name — the loser gets EEXIST and moves to the next. The CLI
 * then renders into the now-existing directory. Errors other than EEXIST (e.g. a missing library root)
 * propagate so the caller can report them.
 */
export function reserveSampleFolder(libraryRoot: string): string {
  for (let i = 1; i <= 1000; i++) {
    const name = i === 1 ? SAMPLE_FOLDER_NAME : `${SAMPLE_FOLDER_NAME}-${i}`;
    const dir = join(libraryRoot, name);
    try {
      mkdirSync(dir);
      return dir;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw e;
    }
  }
  throw new Error("could not reserve an unused sample folder name in this library");
}

export interface RenderSampleResult {
  code: number;
  stdout: string;
  stderr: string;
  folder: string;
}

/** The witness CLI args to render the bundled sample input into outDir, with the carrier bundles. */
export function sampleRenderArgs(cliPath: string, inputPath: string, outDir: string): string[] {
  return [cliPath, inputPath, outDir, "--okf", "--pam"];
}

/** Render the bundled sample input into `<libraryRoot>/lyhna-sample-receipt/` using the witness CLI. */
export function renderSample(cliPath: string, inputPath: string, libraryRoot: string): Promise<RenderSampleResult> {
  // Atomically reserve a fresh folder (never overwrites; safe against double-clicks) before rendering.
  const folder = reserveSampleFolder(libraryRoot);
  const args = sampleRenderArgs(cliPath, inputPath, folder);
  return new Promise<RenderSampleResult>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        folder
      })
    );
  });
}
