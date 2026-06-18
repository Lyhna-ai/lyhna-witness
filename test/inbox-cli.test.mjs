import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/inbox-cli.mjs", import.meta.url));
const examples = fileURLToPath(new URL("../examples", import.meta.url));

// Run the CLI, capturing stdout/stderr/exit code without throwing on a non-zero exit.
function run(args) {
  try {
    const stdout = execFileSync("node", [cli, ...args], { encoding: "utf8" });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

function freshRoot() {
  return mkdtempSync(join(tmpdir(), "lyhna-inbox-cli-"));
}
function capsuleFolder(root, name, files) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(dir, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

// The ESC byte (0x1B) that every ANSI color/style sequence begins with.
const ESC = String.fromCharCode(27);

// ---------------------------------------------------------------------------
// Human output
// ---------------------------------------------------------------------------

test("human output over examples lists the full capsules", () => {
  const { code, stdout } = run([examples]);
  assert.equal(code, 0);
  assert.match(stdout, /Lyhna receipt inbox/);
  assert.match(stdout, /2 receipts/);
  assert.match(stdout, /agent-team/);
  assert.match(stdout, /live-loop/);
  // verdict + spine + agents surface for the agent-team capsule
  assert.match(stdout, /DO_NOT_CONTINUE/);
  assert.match(stdout, /4 steps · 1 supported · 1 mismatch · 3 unsupported · 2 do-not-send/);
  assert.match(stdout, /agents: research, writer, parent/);
  assert.match(stdout, /receipt_id: rcpt-q2-2026-0617/);
  // full capsules only by default: no degraded handoff-only folders
  assert.doesNotMatch(stdout, /\[partial\]/);
});

test("no ANSI color codes in human output", () => {
  const { stdout } = run([examples, "--include-partial"]);
  // The kind tags ("[partial]") use a plain bracket but never an ESC byte, so checking for ESC is the
  // correct "no color" assertion.
  assert.ok(!stdout.includes(ESC), "output contains no ANSI escape sequences");
});

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

test("--json emits parseable, deterministic JSON with no timestamp", () => {
  const a = run([examples, "--json"]);
  assert.equal(a.code, 0);
  const parsed = JSON.parse(a.stdout);
  assert.equal(parsed.schema, "lyhna-inbox/v0");
  assert.equal(parsed.count, 2);
  assert.equal(parsed.shown, 2);
  assert.equal(parsed.included_partial, false);
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[0].folderName, "agent-team");
  // run-level inbox output carries no wall-clock field
  assert.ok(!("generated_at" in parsed));
  assert.ok(!("timestamp" in parsed));
  // deterministic: byte-identical across runs
  const b = run([examples, "--json"]);
  assert.equal(a.stdout, b.stdout);
});

test("--json does not fabricate spine fields on a plain capsule", () => {
  const { stdout } = run([examples, "--json"]);
  const parsed = JSON.parse(stdout);
  const live = parsed.entries.find((e) => e.folderName === "live-loop");
  assert.equal(live.receipt_id, null);
  assert.equal(live.parent_loop_id, null);
  assert.equal(live.agents, null);
});

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

test("--include-partial controls degraded (handoff-only) entries", () => {
  const without = JSON.parse(run([examples, "--json"]).stdout);
  const withPartial = JSON.parse(run([examples, "--json", "--include-partial"]).stdout);
  assert.equal(without.count, 2);
  assert.equal(withPartial.count, 6);
  assert.equal(withPartial.included_partial, true);
  const partials = withPartial.entries.filter((e) => e.kind === "partial");
  assert.equal(partials.length, 4);
  // human view marks them
  assert.match(run([examples, "--include-partial"]).stdout, /\[partial\]/);
});

test("--limit caps the entries shown but reports the true total", () => {
  const parsed = JSON.parse(run([examples, "--json", "--limit", "1"]).stdout);
  assert.equal(parsed.count, 2, "true total preserved");
  assert.equal(parsed.shown, 1);
  assert.equal(parsed.entries.length, 1);
  // human header reflects the truncation
  assert.match(run([examples, "--limit", "1"]).stdout, /showing 1 of 2 receipts/);
});

test("--limit=0 shows nothing but still reports the total", () => {
  const parsed = JSON.parse(run([examples, "--json", "--limit=0"]).stdout);
  assert.equal(parsed.count, 2);
  assert.equal(parsed.shown, 0);
  assert.equal(parsed.entries.length, 0);
});

test("--limit rejects a non-integer value with a clear error", () => {
  const { code, stderr } = run([examples, "--limit", "lots"]);
  assert.equal(code, 2);
  assert.match(stderr, /--limit must be a non-negative integer/);
});

test("--help prints usage and exits 0", () => {
  const { code, stdout } = run(["--help"]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /--include-partial/);
  assert.match(stdout, /--json/);
});

test("an unknown option fails with a clear error", () => {
  const { code, stderr } = run([examples, "--bogus"]);
  assert.equal(code, 2);
  assert.match(stderr, /unknown option: --bogus/);
});

// ---------------------------------------------------------------------------
// Error handling / robustness
// ---------------------------------------------------------------------------

test("a missing root exits nonzero with a clear stderr message", () => {
  const { code, stderr, stdout } = run([join(freshRoot(), "does-not-exist")]);
  assert.equal(code, 2);
  assert.match(stderr, /cannot read receipt root/);
  assert.equal(stdout, "", "no partial output on failure");
});

test("a missing root argument exits nonzero", () => {
  const { code, stderr } = run([]);
  assert.equal(code, 2);
  assert.match(stderr, /missing receipt-library root/);
});

test("a malformed capsule.json surfaces as an unreadable warning entry, not a crash", () => {
  const root = freshRoot();
  capsuleFolder(root, "broken", { "capsule.json": "{ not json" });
  capsuleFolder(root, "good", {
    "capsule.json": {
      schema: "lyhna-capsule/v1",
      name: "good",
      objective: "ok",
      verdict: { safe_to_continue: true, summary: { total_steps: 1, supported: 1, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [{ path: "capsule.json" }]
    }
  });
  const human = run([root]);
  assert.equal(human.code, 0, "does not crash on malformed input");
  assert.match(human.stdout, /\[unreadable\]/);
  assert.match(human.stdout, /1 warning/);
  const parsed = JSON.parse(run([root, "--json"]).stdout);
  const broken = parsed.entries.find((e) => e.folderName === "broken");
  assert.equal(broken.kind, "unreadable");
  assert.ok(broken.warnings.length >= 1);
});

test("an empty library prints a clear empty state and exits 0", () => {
  const { code, stdout } = run([freshRoot()]);
  assert.equal(code, 0);
  assert.match(stdout, /No full capsules found/);
});

// ---------------------------------------------------------------------------
// Deterministic ordering
// ---------------------------------------------------------------------------

test("ordering is deterministic (newest instant first, else folder name)", () => {
  const root = freshRoot();
  const cap = (name, ts) => {
    const m = {
      schema: "lyhna-capsule/v1",
      name,
      objective: "o",
      verdict: { safe_to_continue: true, summary: { total_steps: 0, supported: 0, mismatches: 0, unsupported: 0, do_not_send: 0 } },
      artifacts: [{ path: "capsule.json" }]
    };
    if (ts) m.timestamp = ts;
    return { "capsule.json": m };
  };
  capsuleFolder(root, "older", cap("older", "2026-01-01T00:00:00Z"));
  capsuleFolder(root, "newer", cap("newer", "2026-06-01T00:00:00Z"));
  capsuleFolder(root, "b-no-ts", cap("b-no-ts"));
  capsuleFolder(root, "a-no-ts", cap("a-no-ts"));
  const parsed = JSON.parse(run([root, "--json"]).stdout);
  assert.deepEqual(parsed.entries.map((e) => e.folderName), ["newer", "older", "a-no-ts", "b-no-ts"]);
});
