#!/usr/bin/env node
// Lyhna Desktop — build-time engine smoke check.
//
// Stages the engine exactly as packaging does, then runs the BUNDLED engine against a BUNDLED example and
// the bundled demo input — failing loudly if any engine module won't resolve or any CLI exits non-zero.
// This catches the field failure that passes on a dev box: a missing transitive engine import that only
// surfaces when the engine is shipped on its own. (The companion "no system Node" failure — shelling to a
// `node` that isn't on PATH — is caught by the packaged-app DONE gate; here we use this runtime's node.)
//
// Headless + dependency-free, so it runs in desktop CI.

import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageEngine } from "./stage-engine.mjs";

function fail(msg) {
  console.error(`smoke-engine: FAIL — ${msg}`);
  process.exit(1);
}

function runEngine(label, args) {
  // Spawn the engine on THIS runtime's node (in CI, plain node). A non-zero exit or a module-resolution
  // error (e.g. ERR_MODULE_NOT_FOUND from a missing transitive import) surfaces here.
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.error) fail(`${label}: ${r.error.message}`);
  if (r.status !== 0) {
    fail(`${label}: exit ${r.status}\n--- stderr ---\n${r.stderr}\n--- stdout ---\n${r.stdout}`);
  }
  return r.stdout;
}

const { engineCli, renderCli, sampleInput, exampleLibrary } = stageEngine();
console.log("smoke-engine: staged engine, exercising the bundled CLIs…");

// 1) Inbox CLI over the bundled examples — full import closure of inbox-cli.mjs + capsule-indexer.mjs.
const inboxOut = runEngine("inbox-cli over bundled examples", [engineCli, exampleLibrary, "--json"]);
let index;
try {
  index = JSON.parse(inboxOut);
} catch (e) {
  fail(`inbox-cli did not emit valid JSON: ${e.message}`);
}
if (index.schema !== "lyhna-inbox/v0") fail(`unexpected inbox schema: ${JSON.stringify(index.schema)}`);
if (!Array.isArray(index.entries) || index.entries.length < 1) {
  fail("inbox over bundled examples returned no entries — examples not bundled correctly");
}
console.log(`smoke-engine: inbox OK — ${index.entries.length} bundled example capsule(s) indexed`);

// 2) Render the bundled sample input into a temp library — full import closure of cli.mjs (witnessed-event,
//    generate, labels, contract, okf, pam, capsule).
const outDir = mkdtempSync(join(tmpdir(), "lyhna-smoke-sample-"));
runEngine("cli render of bundled sample input", [renderCli, sampleInput, outDir, "--okf", "--pam"]);
const capsulePath = join(outDir, "capsule.json");
if (!existsSync(capsulePath)) fail(`sample render produced no capsule.json in ${outDir}`);

// 3) Read the rendered capsule back (the "open receipt detail" data path).
let capsule;
try {
  capsule = JSON.parse(readFileSync(capsulePath, "utf8"));
} catch (e) {
  fail(`rendered capsule.json is not valid JSON: ${e.message}`);
}
if (!capsule || typeof capsule !== "object") fail("rendered capsule.json is not an object");
console.log(`smoke-engine: sample render OK — capsule.json written + parsed (schema ${capsule.schema ?? "?"})`);

console.log("smoke-engine: PASS — bundled engine resolves and runs against a bundled example.");
