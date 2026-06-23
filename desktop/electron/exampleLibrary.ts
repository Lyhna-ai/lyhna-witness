// Lyhna Desktop — bundled-examples library resolver (pure over its path args; electron-free).
//
// "Open bundled examples" makes the returned path the ACTIVE receipt library, and the inbox's
// "Create sample receipt" action writes into the active library. When packaged, the bundled examples live
// under the install dir (read-only / admin-owned on an AppImage mount, /Applications, or Program Files),
// so writing a sample there would fail. To keep the open-examples → create-sample → detail loop working on
// a real install, the packaged examples are materialized into a per-user WRITABLE copy under userData.
//
// Electron-free (takes userData as an argument) so it can be exercised by a plain-node/vitest harness.

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Folder name for the per-user writable copy of the bundled examples, under userData. */
export const BUNDLED_EXAMPLES_DIRNAME = "bundled-examples";

export interface ExampleLibraryInputs {
  /** Electron's app.isPackaged. */
  isPackaged: boolean;
  /** The resolved bundled examples dir (the repo examples/ in dev; read-only resources when packaged). */
  exampleLibrary: string;
  /** app.getPath("userData") — where the writable copy is placed when packaged. */
  userDataDir: string;
}

/**
 * The receipt-library path the UI should open for "bundled examples".
 *
 * Dev (not packaged): the bundled examples dir itself — writable in a source checkout, unchanged behavior.
 * Packaged: a writable per-user copy at `<userData>/bundled-examples`. The copy is idempotent — if it
 * already exists it is reused as-is, so a sample the user rendered into it is never clobbered.
 */
export function resolveExampleLibrary(i: ExampleLibraryInputs): string {
  if (!i.isPackaged) return i.exampleLibrary;
  const dest = join(i.userDataDir, BUNDLED_EXAMPLES_DIRNAME);
  if (!existsSync(dest)) {
    mkdirSync(i.userDataDir, { recursive: true });
    cpSync(i.exampleLibrary, dest, { recursive: true });
  }
  return dest;
}
