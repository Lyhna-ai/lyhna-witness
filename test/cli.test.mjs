import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));

// A live-loop capture: the agent claimed a SEND, the witness saw a create_draft → the catch.
const input = {
  objective: "Send the follow-up.",
  steps: [
    {
      claim: { system: "gmail", action: "send", result: "sent the follow-up", user_facing: true },
      event: {
        call: { toolName: "mcp__Gmail__create_draft", arguments: "{}" },
        verdict: { kind: "APPROVED" },
        runtime_report: { returned: true, result_hash: "sha256:abc" }
      }
    }
  ],
  proof_refs: { draft: "id-123" }
};

function run(args, { input: stdin } = {}) {
  try {
    const stdout = execFileSync("node", [cli, ...args], {
      encoding: "utf8",
      input: stdin
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

test("CLI writes the handoff trio and reports the verdict", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const inPath = join(dir, "input.json");
  writeFileSync(inPath, JSON.stringify(input));

  const { code, stdout } = run([inPath, dir]);
  assert.equal(code, 0);
  assert.match(stdout, /DO_NOT_CONTINUE/);
  for (const f of ["handoff.json", "HANDOFF.md", "next-ai-prompt.md"]) {
    assert.ok(existsSync(join(dir, f)), `${f} written`);
  }
  const handoff = JSON.parse(readFileSync(join(dir, "handoff.json"), "utf8"));
  assert.equal(handoff.safe_to_continue, false);
  assert.ok(handoff.steps[0].labels.includes("CLAIMED_ACTUAL_MISMATCH"));
  assert.equal(handoff.proof_refs.draft, "id-123");
});

test("CLI reads from stdin with '-'", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stdout } = run(["-", dir], { input: JSON.stringify(input) });
  assert.equal(code, 0);
  assert.match(stdout, /1 steps/);
});

test("CLI --gate exits 3 when the handoff is not safe to continue", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code } = run(["-", dir, "--gate"], { input: JSON.stringify(input) });
  assert.equal(code, 3);
});

test("CLI --gate exits 0 when every step is supported", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const safe = {
    objective: "Draft it.",
    steps: [
      {
        claim: { system: "gmail", action: "create_draft", result: "drafted", user_facing: true },
        event: { call: { toolName: "mcp__Gmail__create_draft" }, verdict: { kind: "APPROVED" }, runtime_report: { returned: true } }
      }
    ]
  };
  const { code, stdout } = run(["-", dir, "--gate"], { input: JSON.stringify(safe) });
  assert.equal(code, 0);
  assert.match(stdout, /SAFE_TO_CONTINUE/);
});

test("CLI fails cleanly on malformed input", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: "not json" });
  assert.equal(code, 2);
  assert.match(stderr, /not valid JSON/);
});

test("CLI fails cleanly when steps is not an array (no stack trace)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ steps: {} }) });
  assert.equal(code, 2);
  assert.match(stderr, /steps must be an array/);
  assert.doesNotMatch(stderr, /at \w+/); // not a Node stack trace
});

test("CLI fails cleanly on a malformed step entry (e.g. null), not a crash", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ objective: "x", steps: [null] }) });
  assert.equal(code, 2);
  assert.match(stderr, /not a valid witness payload/);
});
