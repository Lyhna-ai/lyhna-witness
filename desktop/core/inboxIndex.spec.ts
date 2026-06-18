import { describe, test, expect } from "vitest";
import { parseInboxIndex, InboxParseError, INBOX_SCHEMA } from "./inboxIndex.js";

const sample = JSON.stringify({
  schema: "lyhna-inbox/v0",
  root: "/receipts",
  included_partial: false,
  count: 1,
  shown: 1,
  entries: [
    {
      folder: "/receipts/live-loop",
      folderName: "live-loop",
      kind: "capsule",
      name: "live-loop",
      objective: "Fix the bug.",
      safe_to_continue: true,
      summary: { total_steps: 1, supported: 1, mismatches: 0, unsupported: 0, do_not_send: 0 },
      parent_loop_id: null,
      receipt_id: null,
      agents: null,
      artifacts: ["capsule.json"],
      missing_files: [],
      timestamp: null,
      warnings: []
    }
  ]
});

describe("parseInboxIndex", () => {
  test("parses well-formed inbox JSON", () => {
    const idx = parseInboxIndex(sample);
    expect(idx.schema).toBe(INBOX_SCHEMA);
    expect(idx.root).toBe("/receipts");
    expect(idx.count).toBe(1);
    expect(idx.entries[0].folderName).toBe("live-loop");
  });

  test("throws a clear error on invalid JSON", () => {
    expect(() => parseInboxIndex("{ not json")).toThrow(InboxParseError);
    expect(() => parseInboxIndex("{ not json")).toThrow(/not valid JSON/);
  });

  test("throws when the top value is not an object", () => {
    expect(() => parseInboxIndex("[]")).toThrow(/not a JSON object/);
    expect(() => parseInboxIndex("42")).toThrow(/not a JSON object/);
  });

  test("throws when entries[] is missing", () => {
    expect(() => parseInboxIndex(JSON.stringify({ root: "/x" }))).toThrow(/missing an entries array/);
  });

  test("defaults envelope scalars from entries when absent", () => {
    const idx = parseInboxIndex(JSON.stringify({ entries: [] }));
    expect(idx.schema).toBe(INBOX_SCHEMA);
    expect(idx.count).toBe(0);
    expect(idx.shown).toBe(0);
    expect(idx.included_partial).toBe(false);
  });
});
