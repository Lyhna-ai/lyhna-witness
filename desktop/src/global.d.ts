// The narrow bridge the preload exposes on window. Kept in sync with electron/preload.ts.
export {};

declare global {
  interface Window {
    lyhna?: {
      getVersion(): Promise<string>;
    };
  }
}
