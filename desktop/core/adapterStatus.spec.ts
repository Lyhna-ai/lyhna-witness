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
    const s = deriveLibrarySignal({ hasLibrary: false, readableCount: 0, unreadableCount: 0 });
    expect(s.tone).toBe("muted");
    expect(s.label).toMatch(/No receipt library/i);
  });
  test("library with no receipts → waiting", () => {
    const s = deriveLibrarySignal({ hasLibrary: true, readableCount: 0, unreadableCount: 0 });
    expect(s.tone).toBe("review");
    expect(s.label).toMatch(/Waiting for first witnessed tool call/i);
  });
  test("library with only unreadable folders → NOT green (no fake 'Receipts present')", () => {
    const s = deriveLibrarySignal({ hasLibrary: true, readableCount: 0, unreadableCount: 2 });
    expect(s.tone).toBe("review");
    expect(s.label).toBe("No readable receipts");
    expect(s.detail).toMatch(/couldn.t be read as a capsule/);
  });
  test("library with readable receipts → present, not a live connection", () => {
    const s = deriveLibrarySignal({ hasLibrary: true, readableCount: 3, unreadableCount: 0 });
    expect(s.tone).toBe("ok");
    expect(s.label).toBe("Receipts present");
    expect(s.detail).toMatch(/3 readable receipts/);
    expect(s.detail).toMatch(/not a live adapter connection/i);
  });
  test("readable + some unreadable → present, notes the skipped folders", () => {
    const s = deriveLibrarySignal({ hasLibrary: true, readableCount: 1, unreadableCount: 2 });
    expect(s.tone).toBe("ok");
    expect(s.detail).toMatch(/1 readable receipt/);
    expect(s.detail).toMatch(/2 unreadable folders skipped/);
  });
  test("never returns a 'Connected' label (no fake green)", () => {
    for (const readable of [0, 1, 99]) {
      expect(deriveLibrarySignal({ hasLibrary: true, readableCount: readable, unreadableCount: 0 }).label).not.toMatch(/^Connected$/);
    }
  });
});

describe("ADAPTER_DISCLAIMER", () => {
  test("states the app can't show a live Connected state", () => {
    expect(ADAPTER_DISCLAIMER).toMatch(/can't show a live/i);
    expect(ADAPTER_DISCLAIMER).toMatch(/Install tab/);
  });
});
