// Lyhna Desktop — inbox data source (node-only transport; deliberately electron-free).
//
// This runs the lyhna-witness inbox CLI (`src/inbox-cli.mjs --json`) over a local receipt-library
// folder and returns its raw stdout. It does NOT parse trust labels or re-implement any receipt/capsule
// semantics — the engine is the source of truth; parsing lives in ../core/inboxIndex. Kept free of any
// `electron` import so it can be exercised by a plain-node harness in a headless environment.

import { spawn } from "node:child_process";

export interface RunInboxResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunInboxOptions {
  includePartial?: boolean;
}

/**
 * Run the engine inbox CLI and capture its output. Uses the current executable as the Node runtime —
 * under Electron that is the Electron binary, so ELECTRON_RUN_AS_NODE=1 makes it behave as Node; under
 * a plain-node harness it is already Node and the flag is a harmless no-op.
 */
export function runInbox(
  engineCliPath: string,
  root: string,
  opts: RunInboxOptions = {}
): Promise<RunInboxResult> {
  const args = [engineCliPath, root, "--json"];
  if (opts.includePartial) args.push("--include-partial");

  return new Promise<RunInboxResult>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
    });
    // Collect raw chunks and decode ONCE at close. Decoding each chunk independently would emit U+FFFD
    // replacement chars whenever a multibyte UTF-8 sequence (e.g. a non-ASCII char in an objective,
    // folder name, or warning) straddles a chunk boundary — silently corrupting the engine output.
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => {
      outChunks.push(d);
    });
    child.stderr.on("data", (d: Buffer) => {
      errChunks.push(d);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(outChunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8")
      })
    );
  });
}
