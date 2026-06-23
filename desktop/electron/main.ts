// Lyhna Desktop — Electron main process (thin shell).
//
// The shell opens a window, resolves where the lyhna-witness engine lives, and exposes a small typed IPC
// surface: pick a receipt-library folder, and run the engine inbox CLI over it. ALL product logic lives in
// the framework-agnostic core (../core) and the node-only transport (./inboxSource). The shell never
// re-implements receipt/capsule semantics and never invents data — it returns the engine's raw output.

import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInbox } from "./inboxSource.js";
import { readReceipt, type ReceiptFilesRaw } from "./receiptSource.js";
import { renderSample } from "./sampleSource.js";
import { resolveEnginePaths } from "./enginePaths.js";
import { resolveExampleLibrary } from "./exampleLibrary.js";

const here = dirname(fileURLToPath(import.meta.url)); // dev: <repo>/desktop/dist-electron

// Where the deterministic engine + its data live. Resolved for three shapes (see enginePaths.ts):
//   - dev from source: the staged-in-repo layout two levels up from the compiled main
//     (dist-electron → desktop → repo);
//   - packaged app: the bundled engine copied into extraResources at <resourcesPath>/engine;
//   - explicit LYHNA_ENGINE_* env overrides, which always win (advanced users / a future Settings pane).
const repoRoot = join(here, "..", "..");
const { engineCli, renderCli, sampleInput, exampleLibrary } = resolveEnginePaths({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  repoRoot,
  env: process.env
});

type LoadInboxResult = { ok: true; stdout: string } | { ok: false; error: string };

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    title: "Lyhna Desktop",
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: join(here, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(here, "../dist/index.html"));
  }
}

ipcMain.handle("lyhna:getVersion", () => app.getVersion());

// Let the user choose a local receipt-library folder. Returns the path, or null if cancelled.
ipcMain.handle("lyhna:selectLibrary", async (): Promise<string | null> => {
  const r = await dialog.showOpenDialog({
    title: "Select receipt library folder",
    properties: ["openDirectory"]
  });
  return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
});

// The bundled example capsules — real, committed receipts to try the inbox against. When packaged, the
// examples sit under the read-only install dir; since the UI makes this the active library (and lets the
// user render a sample into it), materialize a writable per-user copy under userData and return that.
ipcMain.handle("lyhna:exampleLibraryPath", (): string =>
  resolveExampleLibrary({
    isPackaged: app.isPackaged,
    exampleLibrary,
    userDataDir: app.getPath("userData")
  })
);

// Run the engine inbox CLI over a folder; return its raw JSON stdout (the renderer parses it via core).
ipcMain.handle(
  "lyhna:loadInbox",
  async (_e, root: string, includePartial: boolean): Promise<LoadInboxResult> => {
    try {
      const { code, stdout, stderr } = await runInbox(engineCli, root, { includePartial });
      if (code !== 0) {
        return { ok: false, error: stderr.trim() || `inbox exited with code ${code}` };
      }
      return { ok: true, stdout };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
);

// Read one capsule folder's receipt files (raw); the renderer shapes them via core/receiptDetail.
ipcMain.handle(
  "lyhna:loadReceipt",
  async (_e, folder: string): Promise<{ ok: true; files: ReceiptFilesRaw } | { ok: false; error: string }> => {
    try {
      return { ok: true, files: await readReceipt(folder) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
);

// Render the bundled SAMPLE input into the user's library (real engine, demo input — not a live run).
ipcMain.handle(
  "lyhna:createSampleReceipt",
  async (_e, libraryRoot: string): Promise<{ ok: true; folder: string } | { ok: false; error: string }> => {
    if (typeof libraryRoot !== "string" || libraryRoot.length === 0) {
      return { ok: false, error: "Select a receipt library folder first." };
    }
    try {
      const r = await renderSample(renderCli, sampleInput, libraryRoot);
      if (r.code !== 0) {
        return { ok: false, error: r.stderr.trim() || `sample render exited with code ${r.code}` };
      }
      return { ok: true, folder: r.folder };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
);

// Reveal a capsule folder in the OS file manager so the user can grab its existing artifacts. Read-only:
// it opens the folder, it never creates or modifies receipt files.
ipcMain.handle(
  "lyhna:openFolder",
  async (_e, folder: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (typeof folder !== "string" || folder.length === 0) {
      return { ok: false, error: "No folder to open." };
    }
    try {
      const err = await shell.openPath(folder); // returns "" on success, else an error string
      return err ? { ok: false, error: err } : { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
);

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
