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

const here = dirname(fileURLToPath(import.meta.url)); // <repo>/desktop/dist-electron

// Where the deterministic engine lives. In the staged-in-repo layout the engine sits two levels up from
// the compiled main (dist-electron → desktop → repo). Overridable for packaging / a future Settings pane.
const repoRoot = join(here, "..", "..");
const engineCli = process.env.LYHNA_ENGINE_CLI ?? join(repoRoot, "src", "inbox-cli.mjs");
const exampleLibrary = process.env.LYHNA_EXAMPLE_LIBRARY ?? join(repoRoot, "examples");

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

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
