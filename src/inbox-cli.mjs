#!/usr/bin/env node
// Lyhna Desktop — headless local receipt inbox (CLI).
//
// The first real inbox PRIMITIVE for Lyhna Desktop, before any GUI: point it at a local receipt/capsule
// library folder and it lists the Work Receipt Capsules inside — what each run claimed, what was
// witnessed, and what needs review — by reading the capsule files the engine already produces. It does
// not run or orchestrate agents, make network calls, or invent live adapter status. It is the read model
// the desktop app's receipt inbox will sit on top of.
//
// Honesty ceiling carries straight through from the indexer: it reports only what `capsule.json` (or, in
// clearly-marked degraded mode, `handoff.json`) says, never fabricates absent fields, and surfaces a
// malformed capsule as an `unreadable` warning entry rather than crashing. Determinism by contract: no
// clock, no randomness, no model calls — same library tree ⇒ byte-identical output. No ANSI color.
//
// Usage:
//   node src/inbox-cli.mjs <receipt-library-root> [--json] [--include-partial] [--limit <n>]
//   node src/inbox-cli.mjs --help
//
// Flags:
//   --json              emit the inbox as JSON (deterministic; no timestamps) instead of text.
//   --include-partial   also list folders that have handoff.json but no capsule.json, as degraded
//                       ("partial") entries clearly marked "not a full capsule". Off by default.
//   --limit <n>         show at most n entries (after the deterministic sort). n must be a non-negative
//                       integer. The reported total `count` still reflects everything found.
//   --help, -h          print this help and exit 0.
//
// Exit codes: 0 ok · 2 usage error / unreadable root.

import { indexReceiptLibrary } from "./capsule-indexer.mjs";

const PROG = "lyhna-inbox";
const USAGE = `Usage: node src/inbox-cli.mjs <receipt-library-root> [--json] [--include-partial] [--limit <n>]
       node src/inbox-cli.mjs --help`;

function fail(message, code = 2) {
  process.stderr.write(`${PROG}: ${message}\n`);
  process.exit(code);
}

function printHelp() {
  process.stdout.write(
    `${PROG} — list the Lyhna Work Receipt Capsules in a local receipt library.\n\n` +
      `${USAGE}\n\n` +
      `Reads a local receipt/capsule library root and treats each immediate child folder as a\n` +
      `possible capsule (a folder containing capsule.json). It reads only what the capsule files\n` +
      `say — it does not run agents, make network calls, or report live adapter status.\n\n` +
      `Flags:\n` +
      `  --json              emit JSON (deterministic; no timestamps) instead of text\n` +
      `  --include-partial   also list handoff-only folders as degraded "partial" entries\n` +
      `  --limit <n>         show at most n entries (n >= 0); total count still reflects all found\n` +
      `  --help, -h          print this help\n\n` +
      `Exit codes: 0 ok · 2 usage error / unreadable root.\n`
  );
}

function parseArgs(argv) {
  const opts = { root: null, json: false, includePartial: false, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a === "--json") {
      opts.json = true;
    } else if (a === "--include-partial") {
      opts.includePartial = true;
    } else if (a === "--limit" || a.startsWith("--limit=")) {
      const raw = a === "--limit" ? argv[++i] : a.slice("--limit=".length);
      opts.limit = parseLimit(raw);
    } else if (a.startsWith("-")) {
      fail(`unknown option: ${a}\n${USAGE}`);
    } else if (opts.root === null) {
      opts.root = a;
    } else {
      fail(`unexpected extra argument: ${a}\n${USAGE}`);
    }
  }
  if (opts.root === null) {
    fail(`missing receipt-library root.\n${USAGE}`);
  }
  return opts;
}

function parseLimit(raw) {
  if (raw === undefined) fail(`--limit requires a value (a non-negative integer)`);
  if (!/^\d+$/.test(raw)) fail(`--limit must be a non-negative integer, got: ${raw}`);
  return Number(raw);
}

// One summary count, rendering an absent/garbled value (null) as "?" so an incomplete capsule reads
// honestly rather than as a fabricated zero.
const num = (v) => (v === null || v === undefined ? "?" : String(v));

function verdictWord(safe) {
  if (safe === true) return "SAFE_TO_CONTINUE";
  if (safe === false) return "DO_NOT_CONTINUE";
  return "VERDICT_UNKNOWN";
}

// Does this entry carry any verdict summary at all? (An `unreadable` entry has all-null counts.)
function hasSummary(s) {
  return s && Object.values(s).some((v) => v !== null && v !== undefined);
}

function renderHuman({ root, includePartial, count, shown, entries }) {
  const lines = [];
  lines.push(`Lyhna receipt inbox · ${root}`);
  if (count === 0) {
    lines.push(
      includePartial
        ? `No receipts found.`
        : `No full capsules found. Re-run with --include-partial to include handoff-only folders.`
    );
    return lines.join("\n") + "\n";
  }
  lines.push(shown < count ? `showing ${shown} of ${count} receipts` : `${count} receipt${count === 1 ? "" : "s"}`);
  if (includePartial) lines.push(`(degraded/partial entries included)`);
  lines.push("");

  entries.forEach((e, i) => {
    const tag = e.kind === "capsule" ? "" : ` [${e.kind}]`;
    const name = e.name || e.folderName;
    const verdict = hasSummary(e.summary) || typeof e.safe_to_continue === "boolean" ? `  ${verdictWord(e.safe_to_continue)}` : "";
    lines.push(`${i + 1}. ${name}${tag}${verdict}`);
    if (e.objective) lines.push(`   objective: ${e.objective}`);
    if (hasSummary(e.summary)) {
      const s = e.summary;
      lines.push(
        `   verdict: ${num(s.total_steps)} steps · ${num(s.supported)} supported · ${num(s.mismatches)} mismatch · ` +
          `${num(s.unsupported)} unsupported · ${num(s.do_not_send)} do-not-send`
      );
    }
    if (Array.isArray(e.agents) && e.agents.length) {
      const labels = e.agents.map((a) => a.subagent_role || a.agent_id).filter(Boolean);
      if (labels.length) lines.push(`   agents: ${labels.join(", ")}`);
    }
    const idBits = [];
    if (e.receipt_id) idBits.push(`receipt_id: ${e.receipt_id}`);
    if (e.parent_loop_id) idBits.push(`parent_loop_id: ${e.parent_loop_id}`);
    if (idBits.length) lines.push(`   ${idBits.join(" · ")}`);
    const flags = [];
    if (e.warnings && e.warnings.length) flags.push(`${e.warnings.length} warning${e.warnings.length === 1 ? "" : "s"}`);
    if (e.missing_files && e.missing_files.length)
      flags.push(`${e.missing_files.length} missing file${e.missing_files.length === 1 ? "" : "s"}`);
    if (flags.length) lines.push(`   ⚠ ${flags.join(" · ")}`);
    lines.push(`   folder: ${e.folder}`);
    lines.push("");
  });

  // Trim the trailing blank line into a single terminating newline.
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let idx;
  try {
    idx = indexReceiptLibrary(opts.root, { includePartial: opts.includePartial });
  } catch (err) {
    fail(err.message);
  }

  const all = idx.entries;
  const entries = opts.limit === null ? all : all.slice(0, opts.limit);

  if (opts.json) {
    const out = {
      schema: idx.schema,
      root: idx.root,
      included_partial: opts.includePartial,
      count: idx.count,
      shown: entries.length,
      entries
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return;
  }

  process.stdout.write(
    renderHuman({
      root: idx.root,
      includePartial: opts.includePartial,
      count: idx.count,
      shown: entries.length,
      entries
    })
  );
}

main();
