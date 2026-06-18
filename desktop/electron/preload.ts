// Lyhna Desktop — preload. Exposes a narrow, typed bridge to the renderer. No Node access leaks through.

import { contextBridge, ipcRenderer } from "electron";

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke("lyhna:getVersion")
};

contextBridge.exposeInMainWorld("lyhna", api);

export type LyhnaApi = typeof api;
