// Lyhna Desktop — Electron main process (thin shell).
//
// The shell opens a window, resolves where the lyhna-witness engine lives, and exposes a small typed IPC
// surface: pick a receipt-library folder, and run the engine inbox CLI over it. ALL product logic lives in
// the framework-agnostic core (../core) and the node-only transport (./inboxSource). The shell never
// re-implements receipt/capsule semantics and never invents data — it returns the engine's raw output.

import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInbox } from "./inboxSource.js";
import { readReceipt, type ReceiptFilesRaw } from "./receiptSource.js";
import { renderSample } from "./sampleSource.js";

const here = dirname(fileURLToPath(import.meta.url)); // <repo>/desktop/dist-electron

// Where the deterministic engine lives. In the staged-in-repo layout the engine sits two levels up from
// the compiled main (dist-electron → desktop → repo). Overridable for packaging / a future Settings pane.
const repoRoot = join(here, "..", "..");
const engineCli = process.env.LYHNA_ENGINE_CLI ?? join(repoRoot, "src", "inbox-cli.mjs");
const exampleLibrary = process.env.LYHNA_EXAMPLE_LIBRARY ?? join(repoRoot, "examples");
// The witness renderer CLI + the bundled demo input, for the "Create sample receipt" flow.
const renderCli = process.env.LYHNA_RENDER_CLI ?? join(repoRoot, "src", "cli.mjs");
const sampleInput = process.env.LYHNA_SAMPLE_INPUT ?? join(repoRoot, "demo", "live-loop-witness-input.json");

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

// The repo's bundled example capsules — real, committed receipts to try the inbox against.
ipcMain.handle("lyhna:exampleLibraryPath", (): string => exampleLibrary);

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

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
