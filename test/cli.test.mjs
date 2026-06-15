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

test("CLI does NOT emit okf/ or pam/ without the flags (default trio only)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  writeFileSync(join(dir, "input.json"), JSON.stringify(input));
  const { code } = run([join(dir, "input.json"), dir]);
  assert.equal(code, 0);
  assert.ok(!existsSync(join(dir, "okf")), "okf/ must not be written without --okf");
  assert.ok(!existsSync(join(dir, "pam")), "pam/ must not be written without --pam");
});

test("CLI --okf --pam also emit the OKF and PAM bundles, carrying the receipt's evidence labels", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  writeFileSync(join(dir, "input.json"), JSON.stringify(input));

  const { code, stdout } = run([join(dir, "input.json"), dir, "--okf", "--pam"]);
  assert.equal(code, 0);
  assert.match(stdout, /okf\/, pam\//);

  // OKF: the index + the per-step concept exist, and the step carries the mismatch label (no laundering).
  assert.ok(existsSync(join(dir, "okf", "index.md")), "okf/index.md written");
  const okfStep = readFileSync(join(dir, "okf", "steps", "step-001.md"), "utf8");
  assert.match(okfStep, /CLAIMED_ACTUAL_MISMATCH/);

  // PAM: manifest mirrors the not-safe verdict; every memory item carries an evidence_status.
  const manifest = JSON.parse(readFileSync(join(dir, "pam", "manifest.json"), "utf8"));
  assert.equal(manifest.safe_to_continue, false);
  const mems = readFileSync(join(dir, "pam", "memories.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(mems.length > 0);
  assert.ok(mems.every((m) => typeof m.evidence_status === "string" && m.evidence_status.length > 0), "every PAM item has an evidence_status");
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
  assert.match(stderr, /steps is required and must be an array/);
  assert.doesNotMatch(stderr, /at \w+/); // not a Node stack trace
});

test("CLI fails closed when steps is omitted (no fail-open SAFE handoff from nothing)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  // A dropped capture (no steps) must NOT exit 0 / SAFE_TO_CONTINUE under --gate.
  const { code, stderr } = run(["-", dir, "--gate"], { input: JSON.stringify({ objective: "Send the email" }) });
  assert.equal(code, 2);
  assert.match(stderr, /steps is required/);
});

test("CLI fails cleanly on a malformed step entry (e.g. null), not a crash", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ objective: "x", steps: [null] }) });
  assert.equal(code, 2);
  assert.match(stderr, /steps\[0\] must be an object/);
});

test("CLI rejects a malformed event and does NOT pass --gate (fail-open closed)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  // The P1 case: a string event must not become a SUPPORTED observation that exits 0 under --gate.
  const { code, stderr } = run(["-", dir, "--gate"], { input: JSON.stringify({ objective: "Send the email", steps: [{ event: "bad" }] }) });
  assert.equal(code, 2);
  assert.match(stderr, /event must be an object/);
});

test("CLI rejects an event with no call.toolName", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ steps: [{ event: { call: {} } }] }) });
  assert.equal(code, 2);
  assert.match(stderr, /toolName must be a non-empty string/);
});

test("CLI rejects a step with neither a claim nor an event", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ steps: [{}] }) });
  assert.equal(code, 2);
  assert.match(stderr, /must have a claim or an event/);
});

test("CLI rejects a claim with no system", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ steps: [{ claim: { action: "send" } }] }) });
  assert.equal(code, 2);
  assert.match(stderr, /claim\.system must be a non-empty string/);
});

test("CLI requires a verdict on an event (truncated capture is not safe)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir, "--gate"], { input: JSON.stringify({ steps: [{ event: { call: { toolName: "gmail.send" } } }] }) });
  assert.equal(code, 2);
  assert.match(stderr, /verdict\.kind must be a non-empty string/);
});

test("CLI requires runtime_report.returned for an APPROVED event", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  const { code, stderr } = run(["-", dir], { input: JSON.stringify({ steps: [{ event: { call: { toolName: "gmail.send" }, verdict: { kind: "APPROVED" } } }] }) });
  assert.equal(code, 2);
  assert.match(stderr, /runtime_report\.returned .* required for an APPROVED/);
});

test("CLI: a no-claim REFUSED event is valid but does NOT pass --gate (labeler fail-closed)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  // Legitimate blocked event (no runtime report) — accepted by validation, but an unclaimed
  // non-successful observation must not read as SAFE_TO_CONTINUE.
  const { code, stdout } = run(["-", dir, "--gate"], { input: JSON.stringify({ steps: [{ event: { call: { toolName: "stripe.refund" }, verdict: { kind: "REFUSED" } } }] }) });
  assert.equal(code, 3);
  assert.match(stdout, /DO_NOT_CONTINUE/);
});

test("CLI rejects an unknown verdict kind (only proxy verdicts pass the gate)", () => {
  const dir = mkdtempSync(join(tmpdir(), "witness-cli-"));
  // "DENIED" + returned:true must NOT be treated as an unblocked APPROVED-like call.
  const { code, stderr } = run(["-", dir, "--gate"], {
    input: JSON.stringify({ steps: [{ event: { call: { toolName: "x" }, verdict: { kind: "DENIED" }, runtime_report: { returned: true } } }] })
  });
  assert.equal(code, 2);
  assert.match(stderr, /must be one of APPROVED, REFUSED, ESCALATED/);
});
