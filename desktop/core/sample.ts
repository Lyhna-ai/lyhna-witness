// Lyhna Desktop — sample-receipt identity (pure, browser-safe, shared by inbox + detail).
//
// A "Create sample receipt" run writes the bundled DEMO capsule into the library under a fixed,
// recognizable folder name (lyhna-sample-receipt, or a numbered sibling). The UI uses this to label such
// receipts as samples wherever they appear, so a bundled-demo receipt is never read as a live/user run.
//
// NOTE: the renderer cannot import the node-only electron/sampleSource module, so the canonical folder
// name lives here; electron/sampleSource.ts keeps a matching constant (kept in sync — same literal).

export const SAMPLE_FOLDER_NAME = "lyhna-sample-receipt";

const SAMPLE_RE = new RegExp(`^${SAMPLE_FOLDER_NAME}(?:-\\d+)?$`);

/** True if a folder path is a generated sample capsule (base name or a numbered sibling). */
export function isSampleFolder(folderPath: string): boolean {
  const name = folderPath.split(/[\\/]+/).filter(Boolean).pop() ?? "";
  return SAMPLE_RE.test(name);
}
