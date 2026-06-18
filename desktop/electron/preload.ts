// Lyhna Desktop — preload. Exposes a narrow, typed bridge to the renderer. No Node access leaks through.

import { contextBridge, ipcRenderer } from "electron";

export type LoadInboxResult = { ok: true; stdout: string } | { ok: false; error: string };

export interface ReceiptFilesRaw {
  folder: string;
  handoffMarkdown: string | null;
  capsuleJson: string | null;
  handoffJson: string | null;
  presentNames: string[];
}
export type LoadReceiptResult = { ok: true; files: ReceiptFilesRaw } | { ok: false; error: string };
export type CreateSampleResult = { ok: true; folder: string } | { ok: false; error: string };
export type OpenFolderResult = { ok: true } | { ok: false; error: string };

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke("lyhna:getVersion"),
  selectLibrary: (): Promise<string | null> => ipcRenderer.invoke("lyhna:selectLibrary"),
  exampleLibraryPath: (): Promise<string> => ipcRenderer.invoke("lyhna:exampleLibraryPath"),
  loadInbox: (root: string, includePartial: boolean): Promise<LoadInboxResult> =>
    ipcRenderer.invoke("lyhna:loadInbox", root, includePartial),
  loadReceipt: (folder: string): Promise<LoadReceiptResult> => ipcRenderer.invoke("lyhna:loadReceipt", folder),
  createSampleReceipt: (libraryRoot: string): Promise<CreateSampleResult> =>
    ipcRenderer.invoke("lyhna:createSampleReceipt", libraryRoot),
  openFolder: (folder: string): Promise<OpenFolderResult> => ipcRenderer.invoke("lyhna:openFolder", folder)
};

contextBridge.exposeInMainWorld("lyhna", api);

export type LyhnaApi = typeof api;
