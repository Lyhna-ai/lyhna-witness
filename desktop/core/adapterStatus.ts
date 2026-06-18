// Lyhna Desktop — adapter status (pure, honest).
//
// Lyhna Desktop does NOT start or watch the MCP adapter process yet, so it can't observe a live
// connection — it must never show a fake green "Connected". This module provides:
//  - ADAPTER_STATES: the four honest connection states (a reference legend), what each means;
//  - deriveLibrarySignal(): the ONLY status the app can truthfully derive today — from the local receipt
//    library it can read (no library / no receipts yet / receipts present). It never claims "Connected".
// Pure + deterministic so it unit-tests headlessly.

export interface AdapterState {
  id: string;
  label: string;
  meaning: string;
}

// The four states the desktop will show once it manages the adapter. Until then they're a legend so the
// user knows what to expect; the app only asserts the library-derived signal below.
export const ADAPTER_STATES: AdapterState[] = [
  {
    id: "not-connected",
    label: "Not connected · outside witness path",
    meaning: "The agent's tool calls aren't routing through Lyhna, so nothing is being witnessed."
  },
  {
    id: "waiting",
    label: "Waiting for first witnessed tool call",
    meaning: "Routed through Lyhna, but no call has crossed the boundary yet — make one to see a receipt."
  },
  {
    id: "test-receipt",
    label: "Test receipt created",
    meaning: "A receipt has been rendered — open it in the inbox to read the claimed-vs-witnessed verdict."
  },
  {
    id: "connected",
    label: "Connected",
    meaning: "Confirmed that calls are routing through Lyhna. Shown only when actually verified — never assumed."
  }
];

export type LibrarySignalTone = "ok" | "review" | "muted";

export interface LibrarySignal {
  label: string;
  tone: LibrarySignalTone;
  detail: string;
}

/**
 * The honest, library-derived status — the only thing the app can assert without managing the adapter.
 * It reports presence of receipts, never a live connection.
 */
export function deriveLibrarySignal(input: { hasLibrary: boolean; receiptCount: number }): LibrarySignal {
  if (!input.hasLibrary) {
    return {
      label: "No receipt library checked",
      tone: "muted",
      detail: "Pick a receipt library to see what Lyhna can tell from it."
    };
  }
  if (input.receiptCount <= 0) {
    return {
      label: "Waiting for first witnessed tool call",
      tone: "review",
      detail: "This library has no receipts yet. Route an agent's tool calls through Lyhna to create one."
    };
  }
  return {
    label: "Receipts present",
    tone: "ok",
    detail: `${input.receiptCount} receipt${input.receiptCount === 1 ? "" : "s"} in this library — open the inbox to read them. (This shows receipts exist, not a live adapter connection.)`
  };
}

export const ADAPTER_DISCLAIMER =
  "Lyhna Desktop doesn't start or watch the MCP adapter yet, so it can't show a live “Connected” state. " +
  "It reports only what it can tell from your local receipt library, and points you to setup. Connect your " +
  "agent from the Install tab.";
