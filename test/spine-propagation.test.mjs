import { test } from "node:test";
import assert from "node:assert/strict";

import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "../src/generate.mjs";
import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { renderOkfBundle } from "../src/okf.mjs";
import { renderPamBundle } from "../src/pam.mjs";
import { renderCapsule } from "../src/capsule.mjs";

const spineInput = {
  objective: "Parent dispatches research + writer subagents.",
  parent_loop_id: "loop-42",
  receipt_id: "rcpt-7",
  steps: [
    {
      agent_id: "research-1",
      subagent_role: "research",
      claim: { system: "filesystem", action: "read_file", result: "read the spec", claim_turn_id: "t1" },
      event: {
        call: { toolName: "mcp__filesystem__read_file", call_id: "call-1" },
        verdict: { kind: "APPROVED" },
        runtime_report: { returned: true },
        turn_ref: "t1"
      }
    },
    {
      agent_id: "writer-1",
      subagent_role: "writer",
      claim: { system: "gmail", action: "send", result: "emailed the client", user_facing: true },
      event: null
    }
  ]
};

const plainInput = {
  objective: "Plain run.",
  steps: [{ claim: { system: "filesystem", action: "write_file" }, event: { call: { toolName: "mcp__filesystem__write_file" }, verdict: { kind: "APPROVED" }, runtime_report: { returned: true } } }]
};

const spine = buildWitnessedHandoff(runFromWitnessedEvents(spineInput));
const plain = buildWitnessedHandoff(runFromWitnessedEvents(plainInput));

test("HANDOFF.md surfaces agent attribution + per-step contract on a spine run, nothing on a plain run", () => {
  const md = renderHandoffMarkdown(spine);
  assert.match(md, /## Agent Attribution/);
  assert.match(md, /Research agent/);
  assert.match(md, /Writer agent.*not all supported.*unsupported/s);
  assert.match(md, /Contract: by Research agent · status: supported/);
  // Plain run is unchanged — no attribution surface leaks in.
  const plainMd = renderHandoffMarkdown(plain);
  assert.doesNotMatch(plainMd, /Agent Attribution|Contract:/);
});

test("HANDOFF.md never claims the unsupported send happened", () => {
  const md = renderHandoffMarkdown(spine);
  // The writer's send is unsupported — must not read as sent/delivered.
  const writerLine = md.split("\n").find((l) => l.includes("Writer agent") && l.includes("step"));
  assert.ok(writerLine && /not all supported/.test(writerLine));
  assert.doesNotMatch(md, /\bemail (was )?delivered\b/i);
});

test("next-ai-prompt warns the continuing agent off the unsupported subagent branch", () => {
  const p = renderNextAiPrompt(spine);
  assert.match(p, /Agent attribution/);
  assert.match(p, /Writer agent.*not all supported.*do not trust/s);
  assert.doesNotMatch(renderNextAiPrompt(plain), /Agent attribution/);
});

test("OKF carries the contract (step frontmatter + reader_explanation + Agents section), no laundering", () => {
  const okf = renderOkfBundle(spine, { name: "x" });
  const step2 = okf["steps/step-002.md"];
  assert.match(step2, /contract_status: "unsupported"/);
  assert.match(step2, /agent_id: "writer-1"/);
  assert.match(step2, /\*\*Contract:\*\*/);
  assert.match(okf["handoffs/x.md"], /## Agents/);
  assert.match(okf["handoffs/x.md"], /parent_loop_id: "loop-42"/);
  // The OKF's OWN continuation prompt must also carry the attribution (OKF-only consumers).
  assert.match(okf["prompts/next-ai-prompt.md"], /Agent attribution/);
  assert.match(okf["prompts/next-ai-prompt.md"], /writer agent.*not all supported.*do not trust/is);
  // The unsupported step's label is preserved — not upgraded.
  assert.match(step2, /UNSUPPORTED/);
  // A plain run's OKF has no contract fields.
  const plainOkf = renderOkfBundle(plain, { name: "p" });
  assert.doesNotMatch(plainOkf["steps/step-001.md"], /contract_status|agent_id/);
});

test("PAM episodic items carry contract attribution beside evidence_status; manifest carries run spine", () => {
  const pam = renderPamBundle(spine, { name: "x" });
  const mems = pam["memories.jsonl"].trim().split("\n").map((l) => JSON.parse(l));
  const ep2 = mems.find((m) => m.id === "episodic:step-2");
  assert.equal(ep2.contract_status, "unsupported");
  assert.equal(ep2.agent_id, "writer-1");
  // evidence_status still governs — the unsupported step is not upgraded by the attribution.
  assert.ok(["UNSUPPORTED", "DO_NOT_SEND"].includes(ep2.evidence_status));
  assert.equal(ep2.supported, false);
  const manifest = JSON.parse(pam["manifest.json"]);
  assert.equal(manifest.parent_loop_id, "loop-42");
  assert.equal(manifest.receipt_id, "rcpt-7");
  assert.ok(Array.isArray(manifest.agents) && manifest.agents.length === 2);
  // Plain run: no spine in the manifest, no contract on items.
  const plainPam = renderPamBundle(plain, { name: "p" });
  assert.equal(JSON.parse(plainPam["manifest.json"]).agents, undefined);
  assert.equal(JSON.parse(plainPam["memories.jsonl"].trim().split("\n")[0]).contract_status, undefined);
});

test("capsule index carries the run spine + Agents section on a spine run only", () => {
  const cap = renderCapsule(spine, { name: "x", exports: ["okf", "pam"] });
  const m = JSON.parse(cap["capsule.json"]);
  assert.equal(m.parent_loop_id, "loop-42");
  assert.equal(m.receipt_id, "rcpt-7");
  assert.ok(Array.isArray(m.agents) && m.agents.length === 2);
  assert.match(cap["CAPSULE.md"], /## Agents witnessed/);
  // Plain capsule is unchanged.
  const plainCap = renderCapsule(plain, { name: "p" });
  assert.equal(JSON.parse(plainCap["capsule.json"]).agents, undefined);
  assert.doesNotMatch(plainCap["CAPSULE.md"], /Agents witnessed/);
});
