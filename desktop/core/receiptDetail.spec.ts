import { describe, test, expect } from "vitest";
import { buildReceiptDetail, type ReceiptFiles } from "./receiptDetail.js";

const capsuleJson = JSON.stringify({
  schema: "lyhna-capsule/v1",
  name: "agent-team",
  objective: "Prepare and send the Q2 client report.",
  verdict: { safe_to_continue: false, summary: { total_steps: 4, supported: 1, mismatches: 1, unsupported: 3, do_not_send: 2 } },
  parent_loop_id: "loop-q2-client-report",
  receipt_id: "rcpt-q2-2026-0617",
  agents: [{ agent_id: "research-1", subagent_role: "research" }],
  artifacts: [
    { path: "HANDOFF.md", role: "The AI Work Receipt (readable)", trust_boundary: "witnessed-receipt" },
    { path: "okf/", role: "OKF knowledge bundle", trust_boundary: "carrier-projection" }
  ]
});

const handoffJson = JSON.stringify({
  objective: "Prepare and send the Q2 client report.",
  safe_to_continue: false,
  summary: { total_steps: 2, supported: 1, mismatches: 0, unsupported: 1, do_not_send: 1 },
  steps: [
    {
      index: 0,
      claimed: { system: "filesystem", action: "read_file", result: "read the spec" },
      witnessed: { system: "filesystem", action: "read_file", returned: true },
      labels: ["SUPPORTED"],
      human_note: "The witnessed tool action matches the claim."
    },
    {
      index: 1,
      claimed: { system: "gmail", action: "send", result: "emailed the client" },
      witnessed: null,
      labels: ["UNSUPPORTED", "DO_NOT_SEND"],
      human_note: "No send was witnessed."
    }
  ]
});

const baseFiles: ReceiptFiles = {
  folder: "/receipts/agent-team",
  handoffMarkdown: "# AI Work Receipt\n\nClaimed vs witnessed…",
  capsuleJson,
  handoffJson,
  presentNames: ["CAPSULE.md", "capsule.json", "HANDOFF.md", "handoff.json", "okf"]
};

describe("buildReceiptDetail", () => {
  test("renders engine fields verbatim (no re-judging)", () => {
    const d = buildReceiptDetail(baseFiles);
    expect(d.title).toBe("agent-team");
    expect(d.objective).toMatch(/Q2 client report/);
    expect(d.verdictLabel).toMatch(/review/i); // safe_to_continue false → review, never "blocked"
    expect(d.verdictTone).toBe("review");
    expect(d.receiptId).toBe("rcpt-q2-2026-0617");
    expect(d.parentLoopId).toBe("loop-q2-client-report");
    expect(d.handoffMarkdown).toMatch(/AI Work Receipt/);
    expect(d.hasCapsule).toBe(true);
    expect(d.hasHandoff).toBe(true);
  });

  test("prefers capsule verdict summary for the counts line", () => {
    const d = buildReceiptDetail(baseFiles);
    expect(d.summaryLine).toBe("4 steps · 1 supported · 1 mismatch · 3 unsupported · 2 do-not-send");
  });

  test("steps carry the engine's claimed/witnessed text and labels verbatim", () => {
    const d = buildReceiptDetail(baseFiles);
    expect(d.steps).toHaveLength(2);
    expect(d.steps[0].claimedText).toBe("filesystem.read_file — read the spec");
    expect(d.steps[0].witnessedText).toBe("filesystem.read_file · returned");
    expect(d.steps[0].labels).toEqual(["SUPPORTED"]);
    expect(d.steps[1].witnessedText).toBe("no witnessed call");
    expect(d.steps[1].labels).toEqual(["UNSUPPORTED", "DO_NOT_SEND"]);
    expect(d.steps[1].note).toMatch(/No send was witnessed/);
  });

  test("witnessed cue preserves wrapper routing (app), result, and returned state", () => {
    // Mirrors the bundled Hermes/Zapier receipt: claimed google_docs directly, witnessed via the zapier
    // wrapper hitting google_docs — the route that the CLAIMED_ACTUAL_MISMATCH hinges on.
    const handoffJsonRouted = JSON.stringify({
      steps: [
        {
          index: 0,
          claimed: { system: "google_docs", action: "create_document", result: "created" },
          witnessed: { system: "zapier", app: "google_docs", action: "create_document", returned: true, result: "created" },
          labels: ["CLAIMED_ACTUAL_MISMATCH"]
        },
        {
          index: 1,
          claimed: { system: "gmail", action: "send", result: "sent" },
          witnessed: { system: "gmail", action: "send", returned: false },
          labels: ["UNSUPPORTED"]
        }
      ]
    });
    const d = buildReceiptDetail({ ...baseFiles, capsuleJson: null, handoffJson: handoffJsonRouted });
    expect(d.steps[0].claimedText).toBe("google_docs.create_document — created");
    expect(d.steps[0].witnessedText).toBe("zapier→google_docs.create_document · returned · created");
    // returned === false must be visible, not rendered as a silent success
    expect(d.steps[1].witnessedText).toBe("gmail.send · did not return");
  });

  test("artifacts are marked present/missing against the folder listing", () => {
    const d = buildReceiptDetail({ ...baseFiles, presentNames: ["capsule.json", "okf"] });
    const handoffArt = d.artifacts.find((a) => a.path === "HANDOFF.md");
    const okfArt = d.artifacts.find((a) => a.path === "okf/");
    expect(handoffArt?.present).toBe(false); // not in presentNames → missing
    expect(okfArt?.present).toBe(true); // "okf/" matches dir "okf"
    expect(d.warnings.some((w) => /missing on disk: HANDOFF\.md/.test(w))).toBe(true);
  });

  test("degraded: handoff.json only (no capsule) still renders, clearly warned", () => {
    const d = buildReceiptDetail({
      folder: "/receipts/only-handoff",
      handoffMarkdown: null,
      capsuleJson: null,
      handoffJson,
      presentNames: ["handoff.json"]
    });
    expect(d.hasCapsule).toBe(false);
    expect(d.hasHandoff).toBe(true);
    expect(d.title).toBe("only-handoff"); // falls back to folder name
    expect(d.steps).toHaveLength(2);
    expect(d.warnings.some((w) => /degraded view/.test(w))).toBe(true);
  });

  test("malformed handoff steps are skipped with a warning, not a throw", () => {
    const handoffJsonBadSteps = JSON.stringify({
      steps: [
        null,
        "not-a-step",
        { index: 0, claimed: { system: "fs", action: "write" }, witnessed: null, labels: ["UNSUPPORTED", null] }
      ]
    });
    const d = buildReceiptDetail({ ...baseFiles, capsuleJson: null, handoffJson: handoffJsonBadSteps });
    expect(d.steps).toHaveLength(1); // the two malformed entries are dropped
    expect(d.steps[0].claimedText).toBe("fs.write");
    expect(d.steps[0].labels).toEqual(["UNSUPPORTED"]); // non-string label coerced out
    expect(d.warnings.some((w) => /2 steps in handoff\.json could not be read/.test(w))).toBe(true);
  });

  test("malformed capsule artifacts are skipped, not a throw", () => {
    const capsuleBadArtifacts = JSON.stringify({
      schema: "lyhna-capsule/v1",
      name: "corrupt",
      verdict: { safe_to_continue: true, summary: {} },
      artifacts: [null, "nope", { role: "no path" }, { path: "HANDOFF.md" }]
    });
    const d = buildReceiptDetail({ ...baseFiles, capsuleJson: capsuleBadArtifacts, handoffJson: null });
    expect(d.artifacts).toHaveLength(1);
    expect(d.artifacts[0].path).toBe("HANDOFF.md");
  });

  test("malformed capsule.json is recorded as a warning, not a throw", () => {
    const d = buildReceiptDetail({ ...baseFiles, capsuleJson: "{ not json" });
    expect(d.hasCapsule).toBe(false);
    expect(d.warnings.some((w) => /could not be parsed/.test(w))).toBe(true);
    // still renders from handoff.json
    expect(d.steps).toHaveLength(2);
  });
});
