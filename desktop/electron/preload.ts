// Lyhna Desktop — preload. Exposes a narrow, typed bridge to the renderer. No Node access leaks through.

import { contextBridge, ipcRenderer } from "electron";

export type LoadInboxResult = { ok: true; stdout: string } | { ok: false; error: string };

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke("lyhna:getVersion"),
  selectLibrary: (): Promise<string | null> => ipcRenderer.invoke("lyhna:selectLibrary"),
  exampleLibraryPath: (): Promise<string> => ipcRenderer.invoke("lyhna:exampleLibraryPath"),
  loadInbox: (root: string, includePartial: boolean): Promise<LoadInboxResult> =>
    ipcRenderer.invoke("lyhna:loadInbox", root, includePartial)
};

contextBridge.exposeInMainWorld("lyhna", api);

export type LyhnaApi = typeof api;
