import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  indexReceiptLibrary,
  summarizeCapsuleManifest,
  summarizeHandoff,
  folderBaseName,
  INDEXER_SCHEMA,
  CAPSULE_SCHEMA
} from "../src/capsule-indexer.mjs";

const examples = fileURLToPath(new URL("../examples", import.meta.url));

function freshRoot() {
  return mkdtempSync(join(tmpdir(), "lyhna-inbox-"));
}
function capsuleFolder(root, name, files) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(dir, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}
const byName = (entries, name) => entries.find((e) => e.folderName === name);

// ---------------------------------------------------------------------------
// Indexing the real example capsules
// ---------------------------------------------------------------------------

test("indexes the real example capsules (full capsules only)", () => {
  const idx = indexReceiptLibrary(examples, { includePartial: false });
  assert.equal(idx.schema, INDEXER_SCHEMA);
  assert.equal(idx.root, examples);
  // Only agent-team and live-loop carry capsule.json.
  const names = idx.entries.map((e) => e.folderName);
  assert.deepEqual(names, ["agent-team", "live-loop"], "sorted, capsule-only");
  assert.ok(idx.entries.every((e) => e.kind === "capsule"));
});

test("examples/live-loop summarizes its capsule.json faithfully", () => {
  const { entries } = indexReceiptLibrary(examples, { includePartial: false });
  const e = byName(entries, "live-loop");
  assert.equal(e.kind, "capsule");
  assert.equal(e.name, "live-loop");
  assert.equal(e.objective, "Fix the checkout total rounding bug and confirm the fix with the client");
  assert.equal(e.safe_to_continue, false);
  assert.deepEqual(e.summary, {
    total_steps: 3,
    supported: 2,
    mismatches: 0,
    unsupported: 1,
    do_not_send: 1
  });
  // The handoff trio + index pair + the two carriers are declared.
  assert.ok(e.artifacts.includes("HANDOFF.md"));
  assert.ok(e.artifacts.includes("okf/"));
  assert.ok(e.artifacts.includes("pam/"));
  assert.deepEqual(e.missing_files, [], "all declared artifacts exist on disk");
  assert.deepEqual(e.warnings, [], "well-formed capsule has no warnings");
});

test("examples/agent-team preserves the run spine and agent/subagent attribution", () => {
  const { entries } = indexReceiptLibrary(examples, { includePartial: false });
  const e = byName(entries, "agent-team");
  assert.equal(e.parent_loop_id, "loop-q2-client-report");
  assert.equal(e.receipt_id, "rcpt-q2-2026-0617");
  assert.ok(Array.isArray(e.agents));
  assert.equal(e.agents.length, 3);
  const roles = e.agents.map((a) => a.subagent_role);
  assert.deepEqual(roles, ["research", "writer", "parent"]);
  // Attribution preserved, not invented: the writer subagent owns step 3 and is not all-supported.
  const writer = e.agents.find((a) => a.subagent_role === "writer");
  assert.deepEqual(writer.steps, [3]);
  assert.equal(writer.all_supported, false);
});

test("preserves unsupported / DO_NOT_SEND counts", () => {
  const { entries } = indexReceiptLibrary(examples, { includePartial: false });
  assert.equal(byName(entries, "live-loop").summary.unsupported, 1);
  assert.equal(byName(entries, "live-loop").summary.do_not_send, 1);
  assert.equal(byName(entries, "agent-team").summary.unsupported, 3);
  assert.equal(byName(entries, "agent-team").summary.do_not_send, 2);
});

test("does not fabricate receipt_id / agents / artifact_id when absent", () => {
  const { entries } = indexReceiptLibrary(examples, { includePartial: false });
  const e = byName(entries, "live-loop");
  assert.equal(e.receipt_id, null, "no receipt_id on a plain capsule");
  assert.equal(e.parent_loop_id, null);
  assert.equal(e.agents, null, "no agents on a plain capsule");
  // The indexer never introduces an artifact_id field anywhere in the entry.
  assert.ok(!JSON.stringify(e).includes("artifact_id"));
});

// ---------------------------------------------------------------------------
// Degraded (handoff-only) mode
// ---------------------------------------------------------------------------

test("includePartial (default) surfaces handoff-only folders as degraded entries", () => {
  const idx = indexReceiptLibrary(examples); // default includePartial: true
  // 2 full capsules + 4 handoff-only example folders.
  assert.equal(idx.count, 6);
  const partials = idx.entries.filter((e) => e.kind === "partial");
  assert.equal(partials.length, 4);
  for (const p of partials) {
    assert.ok(p.warnings.some((w) => /not a full capsule/.test(w)), "marked degraded");
    assert.equal(p.name, null, "no capsule name invented for a handoff-only folder");
  }
});

test("a handoff-only folder carries the verdict and summary from handoff.json", () => {
  const root = freshRoot();
  capsuleFolder(root, "only-handoff", {
    "handoff.json": {
      objective: "Draft the reply.",
      safe_to_continue: false,
      summary: { total_steps: 2, supported: 1, mismatches: 0, unsupported: 1, do_not_send: 1 }
    }
  });
  const { entries } = indexReceiptLibrary(root);
  assert.equal(entries.length, 1);
  const e = entries[0];
  assert.equal(e.kind, "partial");
  assert.equal(e.objective, "Draft the reply.");
  assert.equal(e.safe_to_continue, false);
  assert.equal(e.summary.unsupported, 1);
  assert.deepEqual(e.artifacts, [], "no declared artifact list without a manifest");
});

test("includePartial:false ignores handoff-only folders", () => {
  const root = freshRoot();
  capsuleFolder(root, "only-handoff", { "handoff.json": { objective: "x", safe_to_continue: true } });
  const idx = indexReceiptLibrary(root, { includePartial: false });
  assert.equal(idx.count, 0);
});

// ---------------------------------------------------------------------------
// Malformed / missing / non-capsule handling
// ---------------------------------------------------------------------------

test("a malformed capsule.json becomes an unreadable entry, not a crash", () => {
  const root = freshRoot();
  capsuleFolder(root, "broken", { "capsule.json": "{ this is not json" });
  const { entries } = indexReceiptLibrary(root);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "unreadable");
  assert.equal(entries[0].folderName, "broken");
  assert.ok(entries[0].warnings.length >= 1);
  assert.ok(/not valid JSON/.test(entries[0].warnings[0]));
});

test("flags declared artifacts that are missing on disk", () => {
  const root = freshRoot();
  capsuleFolder(root, "incomplete", {
    "capsule.json": {
      schema: CAPSULE_SCHEMA,
      name: "incomplete",
      objective: "o",
      verdict: { safe_to_continue: true, summary: { total_steps: 1, supported: 1, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [
        { path: "capsule.json" },
        { path: "HANDOFF.md" },
        { path: "okf/" }
      ]
    }
    // note: HANDOFF.md and okf/ are declared but never written to disk
  });
  const e = indexReceiptLibrary(root).entries[0];
  assert.deepEqual(e.missing_files, ["HANDOFF.md", "okf/"]);
  assert.ok(e.warnings.some((w) => /missing on disk/.test(w)));
});

test("a folder with neither capsule.json nor handoff.json is ignored", () => {
  const root = freshRoot();
  capsuleFolder(root, "not-a-capsule", { "README.md": "# hi" });
  assert.equal(indexReceiptLibrary(root).count, 0);
});

test("an empty receipt root yields no entries", () => {
  const root = freshRoot();
  const idx = indexReceiptLibrary(root);
  assert.equal(idx.count, 0);
  assert.deepEqual(idx.entries, []);
});

test("a missing receipt root throws a descriptive error", () => {
  assert.throws(() => indexReceiptLibrary(join(freshRoot(), "does-not-exist")), /cannot read receipt root/);
  assert.throws(() => indexReceiptLibrary(""), /non-empty path string/);
});

// ---------------------------------------------------------------------------
// Pure summarizers / Windows paths / determinism
// ---------------------------------------------------------------------------

test("folderBaseName tolerates POSIX and Windows separators", () => {
  assert.equal(folderBaseName("/home/me/Receipts/loop-1"), "loop-1");
  assert.equal(folderBaseName("C:\\Users\\Adam\\Receipts\\loop-1"), "loop-1");
  assert.equal(folderBaseName("loop-1"), "loop-1");
});

test("summarizeCapsuleManifest works on a Windows-style folder path (pure, no fs)", () => {
  const manifest = {
    schema: CAPSULE_SCHEMA,
    name: "loop-1",
    objective: "Ship it.",
    verdict: { safe_to_continue: true, summary: { total_steps: 1, supported: 1, mismatches: 0, unsupported: 0, do_not_send: 0 } },
    artifacts: [{ path: "HANDOFF.md" }]
  };
  const e = summarizeCapsuleManifest(manifest, { folder: "C:\\Users\\Adam\\Receipts\\loop-1" });
  assert.equal(e.folder, "C:\\Users\\Adam\\Receipts\\loop-1");
  assert.equal(e.folderName, "loop-1");
  assert.equal(e.safe_to_continue, true);
  assert.deepEqual(e.missing_files, [], "no disk check when presentNames omitted");
});

test("summarizeHandoff produces a degraded entry without touching the filesystem", () => {
  const e = summarizeHandoff(
    { objective: "x", safe_to_continue: true, summary: { total_steps: 0, supported: 0, mismatches: 0, unsupported: 0, do_not_send: 0 } },
    { folder: "/tmp/some/loop" }
  );
  assert.equal(e.kind, "partial");
  assert.equal(e.folderName, "loop");
  assert.ok(e.warnings.length >= 1);
});

test("output is deterministic — same tree yields byte-identical JSON", () => {
  const a = indexReceiptLibrary(examples);
  const b = indexReceiptLibrary(examples);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("ordering is newest-first by capsule timestamp, then by folder name", () => {
  const root = freshRoot();
  const base = (name, ts) => {
    const m = {
      schema: CAPSULE_SCHEMA,
      name,
      objective: "o",
      verdict: { safe_to_continue: true, summary: { total_steps: 0, supported: 0, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [{ path: "capsule.json" }]
    };
    if (ts) m.timestamp = ts;
    return m;
  };
  capsuleFolder(root, "older", { "capsule.json": base("older", "2026-01-01T00:00:00Z") });
  capsuleFolder(root, "newer", { "capsule.json": base("newer", "2026-06-01T00:00:00Z") });
  capsuleFolder(root, "b-no-ts", { "capsule.json": base("b-no-ts") });
  capsuleFolder(root, "a-no-ts", { "capsule.json": base("a-no-ts") });
  const names = indexReceiptLibrary(root).entries.map((e) => e.folderName);
  // timestamped newest→oldest first, then the timestampless ones alphabetically.
  assert.deepEqual(names, ["newer", "older", "a-no-ts", "b-no-ts"]);
});

test("timestamps are ordered as instants, not lexicographically (handles offsets)", () => {
  const root = freshRoot();
  const cap = (name, ts) => ({
    "capsule.json": {
      schema: CAPSULE_SCHEMA,
      name,
      objective: "o",
      verdict: { safe_to_continue: true, summary: { total_steps: 0, supported: 0, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [{ path: "capsule.json" }],
      timestamp: ts
    }
  });
  // 00:30+02:00 is the EARLIER instant (22:30Z) but sorts AFTER 23:00Z lexicographically.
  capsuleFolder(root, "offset-earlier", cap("offset-earlier", "2026-06-18T00:30:00+02:00"));
  capsuleFolder(root, "utc-later", cap("utc-later", "2026-06-17T23:00:00Z"));
  const names = indexReceiptLibrary(root).entries.map((e) => e.folderName);
  // newest instant first: 23:00Z (= the later instant) before 22:30Z.
  assert.deepEqual(names, ["utc-later", "offset-earlier"]);
});

test("an unparseable timestamp falls back to folder-name order, not a crash", () => {
  const root = freshRoot();
  const cap = (name, ts) => ({
    "capsule.json": {
      schema: CAPSULE_SCHEMA,
      name,
      objective: "o",
      verdict: { safe_to_continue: true, summary: { total_steps: 0, supported: 0, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [{ path: "capsule.json" }],
      timestamp: ts
    }
  });
  capsuleFolder(root, "good", cap("good", "2026-06-18T00:00:00Z"));
  capsuleFolder(root, "z-bad", cap("z-bad", "not-a-date"));
  capsuleFolder(root, "a-bad", cap("a-bad", "also-bad"));
  const idx = indexReceiptLibrary(root);
  // parseable instant first, then the unparseable ones by folder name. Raw timestamp string preserved.
  assert.deepEqual(idx.entries.map((e) => e.folderName), ["good", "a-bad", "z-bad"]);
  assert.equal(byName(idx.entries, "z-bad").timestamp, "not-a-date");
});

test("zone-less date-times are not treated as instants (machine-independent order)", () => {
  const root = freshRoot();
  const cap = (name, ts) => ({
    "capsule.json": {
      schema: CAPSULE_SCHEMA,
      name,
      objective: "o",
      verdict: { safe_to_continue: true, summary: { total_steps: 0, supported: 0, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [{ path: "capsule.json" }],
      timestamp: ts
    }
  });
  // A zone-less date-time would be host-TZ-dependent under Date.parse → reject it as a sort instant.
  // The zoned "z-zoned" entry sorts first (it's a real instant); the zone-less one falls back by name.
  capsuleFolder(root, "a-zoneless", cap("a-zoneless", "2026-06-18T00:30:00"));
  capsuleFolder(root, "z-zoned", cap("z-zoned", "2026-06-18T00:00:00Z"));
  const run = () => indexReceiptLibrary(root).entries.map((e) => e.folderName);
  const expected = ["z-zoned", "a-zoneless"];
  assert.deepEqual(run(), expected);
  // Order must not depend on the host time zone.
  const savedTZ = process.env.TZ;
  try {
    process.env.TZ = "Asia/Tokyo";
    assert.deepEqual(run(), expected, "stable under TZ=Asia/Tokyo");
    process.env.TZ = "America/Los_Angeles";
    assert.deepEqual(run(), expected, "stable under TZ=America/Los_Angeles");
  } finally {
    if (savedTZ === undefined) delete process.env.TZ;
    else process.env.TZ = savedTZ;
  }
});
