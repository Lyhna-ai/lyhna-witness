import { describe, test, expect } from "vitest";
import { ADAPTER_STATES, deriveLibrarySignal, ADAPTER_DISCLAIMER } from "./adapterStatus.js";

describe("ADAPTER_STATES legend", () => {
  test("has the four honest states", () => {
    expect(ADAPTER_STATES.map((s) => s.id)).toEqual(["not-connected", "waiting", "test-receipt", "connected"]);
  });
  test("Connected is described as verified-only, never assumed", () => {
    const c = ADAPTER_STATES.find((s) => s.id === "connected");
    expect(c?.meaning).toMatch(/only when actually verified|never assumed/i);
  });
});

describe("deriveLibrarySignal", () => {
  test("no library → muted, no claim", () => {
    const s = deriveLibrarySignal({ hasLibrary: false, receiptCount: 0 });
    expect(s.tone).toBe("muted");
    expect(s.label).toMatch(/No receipt library/i);
  });
  test("library with no receipts → waiting", () => {
    const s = deriveLibrarySignal({ hasLibrary: true, receiptCount: 0 });
    expect(s.tone).toBe("review");
    expect(s.label).toMatch(/Waiting for first witnessed tool call/i);
  });
  test("library with receipts → present, and explicitly not a live connection", () => {
    const s = deriveLibrarySignal({ hasLibrary: true, receiptCount: 3 });
    expect(s.tone).toBe("ok");
    expect(s.label).toBe("Receipts present");
    expect(s.detail).toMatch(/3 receipts/);
    expect(s.detail).toMatch(/not a live adapter connection/i);
  });
  test("never returns a 'Connected' label (no fake green)", () => {
    for (const count of [0, 1, 99]) {
      expect(deriveLibrarySignal({ hasLibrary: true, receiptCount: count }).label).not.toMatch(/^Connected$/);
    }
  });
});

describe("ADAPTER_DISCLAIMER", () => {
  test("states the app can't show a live Connected state", () => {
    expect(ADAPTER_DISCLAIMER).toMatch(/can't show a live/i);
    expect(ADAPTER_DISCLAIMER).toMatch(/Install tab/);
  });
});
