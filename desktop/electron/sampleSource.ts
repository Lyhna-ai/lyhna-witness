// Lyhna Desktop — sample receipt renderer (node-only transport; electron-free).
//
// Runs the real lyhna-witness CLI on the BUNDLED DEMO input to render a real capsule into the user's
// library, so they can see the inbox + detail working end to end. It is sample data — a demo input
// rendered by the real engine — NOT a live witnessed run, and it fakes no routed tool call. The UI labels
// it as a sample; the folder name makes it unmistakable on disk. Electron-free so it's headlessly testable.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const SAMPLE_FOLDER_NAME = "lyhna-sample-receipt";

/**
 * Pick a sample folder name that does NOT already exist in the library, so creating a sample never
 * overwrites an existing receipt folder (a real user capsule could happen to be named the same). Pure:
 * the caller supplies the existence predicate, so it unit-tests without the filesystem.
 */
export function pickSampleFolderName(exists: (name: string) => boolean): string {
  if (!exists(SAMPLE_FOLDER_NAME)) return SAMPLE_FOLDER_NAME;
  for (let i = 2; i <= 1000; i++) {
    const name = `${SAMPLE_FOLDER_NAME}-${i}`;
    if (!exists(name)) return name;
  }
  throw new Error("could not find an unused sample folder name in this library");
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
  // Never overwrite an existing folder — pick the first unused lyhna-sample-receipt[-N] name.
  const folder = join(libraryRoot, pickSampleFolderName((n) => existsSync(join(libraryRoot, n))));
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
