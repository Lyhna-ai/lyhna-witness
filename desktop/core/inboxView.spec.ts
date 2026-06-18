import { describe, test, expect } from "vitest";
import {
  toInboxView,
  toInboxRow,
  verdict,
  countsLine,
  agentLabels,
  isFlagged,
  type InboxIndex
} from "./inboxView.js";

// A fixture mirroring `node src/inbox-cli.mjs examples --json --include-partial` output shape:
// a full capsule with the run spine, a plain full capsule, a degraded handoff-only entry, and an
// unreadable one. Keeps the desktop view model honest against the real engine contract.
const index: InboxIndex = {
  schema: "lyhna-inbox/v0",
  root: "/receipts",
  included_partial: true,
  count: 4,
  shown: 4,
  entries: [
    {
      folder: "/receipts/agent-team",
      folderName: "agent-team",
      kind: "capsule",
      name: "agent-team",
      objective: "Prepare and send the Q2 client report.",
      safe_to_continue: false,
      summary: { total_steps: 4, supported: 1, mismatches: 1, unsupported: 3, do_not_send: 2 },
      parent_loop_id: "loop-q2-client-report",
      receipt_id: "rcpt-q2-2026-0617",
      agents: [
        { agent_id: "research-1", subagent_role: "research", steps: [1, 2], all_supported: false },
        { agent_id: "writer-1", subagent_role: "writer", steps: [3], all_supported: false },
        { agent_id: "orchestrator-1", subagent_role: "parent", steps: [4], all_supported: false }
      ],
      artifacts: ["CAPSULE.md", "capsule.json", "HANDOFF.md", "handoff.json", "next-ai-prompt.md", "okf/", "pam/"],
      missing_files: [],
      timestamp: null,
      warnings: []
    },
    {
      folder: "/receipts/live-loop",
      folderName: "live-loop",
      kind: "capsule",
      name: "live-loop",
      objective: "Fix the checkout total rounding bug.",
      safe_to_continue: true,
      summary: { total_steps: 3, supported: 3, mismatches: 0, unsupported: 0, do_not_send: 0 },
      parent_loop_id: null,
      receipt_id: null,
      agents: null,
      artifacts: ["capsule.json", "HANDOFF.md"],
      missing_files: [],
      timestamp: null,
      warnings: []
    },
    {
      folder: "/receipts/only-handoff",
      folderName: "only-handoff",
      kind: "partial",
      name: null,
      objective: "Draft the reply.",
      safe_to_continue: false,
      summary: { total_steps: 2, supported: 1, mismatches: 0, unsupported: 1, do_not_send: 1 },
      parent_loop_id: null,
      receipt_id: null,
      agents: null,
      artifacts: [],
      missing_files: [],
      timestamp: null,
      warnings: ["no capsule.json — degraded entry indexed from handoff.json; not a full capsule"]
    },
    {
      folder: "/receipts/broken",
      folderName: "broken",
      kind: "unreadable",
      name: null,
      objective: null,
      safe_to_continue: null,
      summary: { total_steps: null, supported: null, mismatches: null, unsupported: null, do_not_send: null },
      parent_loop_id: null,
      receipt_id: null,
      agents: null,
      artifacts: [],
      missing_files: [],
      timestamp: null,
      warnings: ["capsule.json is not valid JSON: Unexpected token"]
    }
  ]
};

describe("verdict mapping (honest, non-gate wording)", () => {
  test("safe → Safe to continue", () => {
    expect(verdict(true)).toEqual({ label: "Safe to continue", tone: "ok" });
  });
  test("not safe → review (never 'blocked')", () => {
    const v = verdict(false);
    expect(v.tone).toBe("review");
    expect(v.label).toMatch(/review/i);
    expect(v.label).not.toMatch(/block/i);
  });
  test("unknown → muted", () => {
    expect(verdict(null)).toEqual({ label: "No verdict recorded", tone: "muted" });
  });
});

describe("countsLine", () => {
  test("renders the five verdict counts", () => {
    expect(countsLine(index.entries[0].summary)).toBe(
      "4 steps · 1 supported · 1 mismatch · 3 unsupported · 2 do-not-send"
    );
  });
  test("returns null when there is no summary (unreadable)", () => {
    expect(countsLine(index.entries[3].summary)).toBeNull();
  });
});

describe("agentLabels", () => {
  test("prefers subagent_role, filters empties", () => {
    expect(agentLabels(index.entries[0].agents)).toEqual(["research", "writer", "parent"]);
  });
  test("null agents → empty", () => {
    expect(agentLabels(null)).toEqual([]);
  });
});

describe("isFlagged", () => {
  test("flags unsupported / do-not-send", () => {
    expect(isFlagged(index.entries[0])).toBe(true);
    expect(isFlagged(index.entries[1])).toBe(false);
  });
});

describe("toInboxRow", () => {
  test("does not fabricate spine fields on a plain capsule", () => {
    const row = toInboxRow(index.entries[1]);
    expect(row.receiptId).toBeNull();
    expect(row.parentLoopId).toBeNull();
    expect(row.agentLabels).toEqual([]);
    expect(row.kindTag).toBeNull();
  });
  test("preserves spine + attribution on an agent-team capsule", () => {
    const row = toInboxRow(index.entries[0]);
    expect(row.receiptId).toBe("rcpt-q2-2026-0617");
    expect(row.parentLoopId).toBe("loop-q2-client-report");
    expect(row.agentLabels).toEqual(["research", "writer", "parent"]);
    expect(row.title).toBe("agent-team");
  });
  test("partial entry is tagged and titled from folderName when unnamed", () => {
    const row = toInboxRow(index.entries[2]);
    expect(row.kindTag).toBe("partial");
    expect(row.title).toBe("only-handoff");
    expect(row.warningCount).toBe(1);
  });
  test("unreadable entry has no verdict/counts and is tagged", () => {
    const row = toInboxRow(index.entries[3]);
    expect(row.kindTag).toBe("unreadable");
    expect(row.countsLine).toBeNull();
    expect(row.verdictTone).toBe("muted");
  });
});

describe("toInboxView", () => {
  test("maps every entry and computes header stats", () => {
    const view = toInboxView(index);
    expect(view.root).toBe("/receipts");
    expect(view.rows).toHaveLength(4);
    expect(view.stats).toEqual({ count: 4, shown: 4, includedPartial: true, flagged: 2 });
  });
});
