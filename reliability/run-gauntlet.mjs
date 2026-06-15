#!/usr/bin/env node
// Lyhna Reliability Gauntlet — orchestrator.
//
// Drives each scenario through the REAL proxy loop (lyhna-mcp-proxy/scripts/gauntlet/driver.mjs) to
// emit a witness-input.json, vendors it under reliability/inputs/ (provenance: produced by the loop,
// not hand-authored), renders the full witness surface, and runs the honesty/reliability invariants.
// Results stream to reliability/results.jsonl; a per-category (batch) pass/fail summary prints as it
// goes.
//
//   node reliability/run-gauntlet.mjs                 # all scenarios, in category batches
//   node reliability/run-gauntlet.mjs 2-claimed-not-witnessed   # one category
//   node reliability/run-gauntlet.mjs --ids c2-email-only,c3-action-mismatch
//
// Requires the sibling lyhna-mcp-proxy checkout (env LYHNA_PROXY_DIR, default ../lyhna-mcp-proxy) with
// its dist built (the driver self-builds on a clean checkout).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

import { scenarios } from "./scenarios.mjs";
import { renderAll, checkInvariants } from "./gauntlet-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const INPUTS_DIR = join(HERE, "inputs");
const RESULTS_PATH = join(HERE, "results.jsonl");
const PROXY_DIR = process.env.LYHNA_PROXY_DIR ?? resolve(HERE, "..", "..", "lyhna-mcp-proxy");
const DRIVER_PATH = join(PROXY_DIR, "scripts", "gauntlet", "driver.mjs");

function parseArgs(argv) {
  const out = { category: null, ids: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--ids") {
      i += 1;
      out.ids = new Set((argv[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    } else if (a.startsWith("--ids=")) {
      out.ids = new Set(a.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean));
    } else if (!a.startsWith("--")) {
      out.category = a;
    }
  }
  return out;
}

async function loadDriver() {
  if (!existsSync(DRIVER_PATH)) {
    throw new Error(
      `proxy gauntlet driver not found at ${DRIVER_PATH}. Set LYHNA_PROXY_DIR to the lyhna-mcp-proxy checkout.`
    );
  }
  const mod = await import(pathToFileURL(DRIVER_PATH).href);
  return mod.runScenario;
}

const sha = (obj) => "sha256:" + createHash("sha256").update(JSON.stringify(obj)).digest("hex");

function loadResults() {
  if (!existsSync(RESULTS_PATH)) return new Map();
  const map = new Map();
  for (const line of readFileSync(RESULTS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      map.set(r.id, r);
    } catch {
      /* skip */
    }
  }
  return map;
}

function writeResults(map) {
  // Persist in scenario-matrix order so the file reads top-to-bottom like the matrix.
  const order = scenarios.map((s) => s.id);
  const lines = order.filter((id) => map.has(id)).map((id) => JSON.stringify(map.get(id)));
  writeFileSync(RESULTS_PATH, lines.join("\n") + "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = scenarios.filter(
    (s) => (!args.category || s.category === args.category) && (!args.ids || args.ids.has(s.id))
  );
  if (selected.length === 0) {
    console.error("no scenarios matched the filter");
    process.exit(2);
  }

  const runScenario = await loadDriver();
  mkdirSync(INPUTS_DIR, { recursive: true });
  const results = loadResults();

  // Group selected scenarios into category batches.
  const batches = new Map();
  for (const s of selected) {
    if (!batches.has(s.category)) batches.set(s.category, []);
    batches.get(s.category).push(s);
  }

  let totalPass = 0;
  let totalFail = 0;
  const p1All = [];

  console.log(`\n=== Lyhna Reliability Gauntlet — ${selected.length} scenario(s), real loop via ${DRIVER_PATH} ===`);

  for (const [category, batch] of batches) {
    console.log(`\n--- batch: ${category} (${batch.length}) ---`);
    let bPass = 0;
    let bFail = 0;
    for (const scenario of batch) {
      let record;
      try {
        const { witnessInput, sealed, exportRc } = await runScenario(scenario);
        // Vendor the loop-produced input for provenance + reproducible re-rendering.
        writeFileSync(join(INPUTS_DIR, `${scenario.id}.json`), JSON.stringify(witnessInput, null, 2) + "\n");

        const rendered = renderAll(witnessInput);
        const { findings, actual } = checkInvariants(scenario, rendered, witnessInput);
        const p1 = findings.filter((f) => f.severity === "P1");
        const status = p1.length > 0 || !sealed || exportRc !== 0 ? "FAIL" : "PASS";
        if (!sealed) findings.push({ severity: "P1", code: "loop-not-sealed", msg: "close did not seal the loop" });
        if (exportRc !== 0) findings.push({ severity: "P1", code: "export-rc", msg: `export-pack rc=${exportRc}` });
        record = {
          id: scenario.id,
          category,
          objective: scenario.objective,
          status,
          provenance: "real-loop",
          sealed,
          export_rc: exportRc,
          input_sha: sha(witnessInput),
          safe_to_continue: actual.safe_to_continue,
          expected_safe: scenario.expect?.safe_to_continue,
          step_labels: actual.step_labels,
          summary: actual.summary,
          findings,
          note: scenario.note ?? null
        };
      } catch (err) {
        record = {
          id: scenario.id,
          category,
          objective: scenario.objective,
          status: "ERROR",
          provenance: "real-loop",
          findings: [{ severity: "P1", code: "driver-error", msg: String(err && err.stack ? err.stack : err) }],
          note: scenario.note ?? null
        };
      }
      results.set(scenario.id, record);
      const p1count = (record.findings ?? []).filter((f) => f.severity === "P1").length;
      const mark = record.status === "PASS" ? "✓" : "✗";
      if (record.status === "PASS") {
        bPass++;
        totalPass++;
      } else {
        bFail++;
        totalFail++;
        for (const f of record.findings.filter((f) => f.severity === "P1")) p1All.push(`${scenario.id}: [${f.code}] ${f.msg}`);
      }
      const warn = (record.findings ?? []).filter((f) => f.severity !== "P1").length;
      console.log(`  ${mark} ${scenario.id.padEnd(32)} ${record.status.padEnd(5)} safe=${record.safe_to_continue}  P1=${p1count} other=${warn}`);
    }
    console.log(`  batch ${category}: ${bPass} pass / ${bFail} fail`);
  }

  writeResults(results);

  console.log(`\n=== TOTAL: ${totalPass} pass / ${totalFail} fail (of ${selected.length}) ===`);
  if (p1All.length) {
    console.log(`\nP1 findings:`);
    for (const p of p1All) console.log(`  - ${p}`);
  }
  console.log(`\nresults → ${RESULTS_PATH}`);
  console.log(`inputs  → ${INPUTS_DIR}/<id>.json (loop-produced)`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nGAUNTLET FATAL:", e && e.stack ? e.stack : e);
  process.exit(1);
});
