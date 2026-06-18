// The narrow bridge the preload exposes on window. Kept in sync with electron/preload.ts.
export {};

type LoadInboxResult = { ok: true; stdout: string } | { ok: false; error: string };

declare global {
  interface Window {
    lyhna?: {
      getVersion(): Promise<string>;
      selectLibrary(): Promise<string | null>;
      exampleLibraryPath(): Promise<string>;
      loadInbox(root: string, includePartial: boolean): Promise<LoadInboxResult>;
    };
  }
}
