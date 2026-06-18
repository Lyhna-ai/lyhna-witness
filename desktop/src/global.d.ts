// The narrow bridge the preload exposes on window. Kept in sync with electron/preload.ts.
export {};

type LoadInboxResult = { ok: true; stdout: string } | { ok: false; error: string };

interface ReceiptFilesRaw {
  folder: string;
  handoffMarkdown: string | null;
  capsuleJson: string | null;
  handoffJson: string | null;
  presentNames: string[];
}
type LoadReceiptResult = { ok: true; files: ReceiptFilesRaw } | { ok: false; error: string };
type CreateSampleResult = { ok: true; folder: string } | { ok: false; error: string };

declare global {
  interface Window {
    lyhna?: {
      getVersion(): Promise<string>;
      selectLibrary(): Promise<string | null>;
      exampleLibraryPath(): Promise<string>;
      loadInbox(root: string, includePartial: boolean): Promise<LoadInboxResult>;
      loadReceipt(folder: string): Promise<LoadReceiptResult>;
      createSampleReceipt(libraryRoot: string): Promise<CreateSampleResult>;
    };
  }
}
