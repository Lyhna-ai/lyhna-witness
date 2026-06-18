// Lyhna Desktop — Electron main process (thin shell).
//
// The shell only opens a window and exposes a small, typed IPC surface. ALL product logic lives in the
// framework-agnostic core (../core) and, later, in node-side data sources that shell out to the
// lyhna-witness inbox CLI. The shell never re-implements receipt/capsule semantics and never invents data.

import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

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

  // In dev, load the Vite dev server; in production, load the built renderer from disk.
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(here, "../dist/index.html"));
  }
}

// Minimal IPC: prove the bridge is wired. Real inbox/adapter IPC arrives in later slices.
ipcMain.handle("lyhna:getVersion", () => app.getVersion());

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
