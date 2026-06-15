// Lyhna dogfood — real-user-style loops (testing in earnest, lane 2).
//
// NOT the synthetic gauntlet matrix. These are realistic agent-work loops (edit + test, draft vs send,
// a PR-style task, a failed migration, an approval/refusal, a route mismatch, an export showcase, a
// two-agent continuation handoff, an out-of-order-claim stress, and a clean happy path). Each is driven
// through the REAL proxy loop (lyhna-mcp-proxy/scripts/gauntlet/driver.mjs — claim capture, scope gate,
// judgment ledger, export-pack) and rendered to the FULL buyer-facing artifact set: HANDOFF.md,
// handoff.json, next-ai-prompt.md, the OKF bundle, and the PAM bundle.
//
// What is real: the whole loop machinery + claim capture + export-pack + the deterministic receipt
// rendering/labels/OKF/PAM. What is synthetic (same posture as the shipped demos): the upstream tool
// BODIES. The witness is action-level — it witnesses that a call crossed the boundary with a verdict +
// result hash — so synthetic bodies are sufficient to test receipt honesty; wiring to live MCP servers
// is the separate deferred "real-traffic" test.
//
//   node dogfood/run-dogfood.mjs [outDir]      default outDir: /tmp/lyhna-dogfood

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { renderAll } from "../reliability/gauntlet-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
// resolve() the env value too — a relative LYHNA_PROXY_DIR must be normalized to an absolute path or
// the within() destructive-output guard below (which compares against the always-resolved OUT) would
// not recognize the proxy checkout and could let `rmSync(OUT)` delete it.
const PROXY_DIR = resolve(process.env.LYHNA_PROXY_DIR ?? resolve(HERE, "..", "..", "lyhna-mcp-proxy"));
const DRIVER = join(PROXY_DIR, "scripts", "gauntlet", "driver.mjs");
const OUT = resolve(process.argv[2] ?? "/tmp/lyhna-dogfood");

// The runner clears OUT before writing, and OUT is a user-supplied arg — so fail closed on any path
// whose deletion would be destructive (root, home, the cwd, the repo, or an ancestor of any of them).
// A typo or `.` must never wipe a checkout or user data; pass a dedicated scratch path instead.
const cwd = process.cwd();
// `p` is unsafe if it IS, CONTAINS (is an ancestor of), or is INSIDE (a descendant of) the cwd or the
// repo — or is root/home. This rejects `.` (the repo), `src` (a descendant — would delete <repo>/src),
// and any ancestor, while allowing a dedicated scratch path like /tmp/lyhna-dogfood.
const within = (p, base) => p === base || p.startsWith(base + sep) || base.startsWith(p + sep);
const isDangerousOut = (p) =>
  p === resolve("/") ||
  p === resolve(homedir()) ||
  within(p, cwd) ||
  within(p, REPO_ROOT) ||
  within(p, PROXY_DIR); // the sibling proxy is a required checkout — a typo must not delete it
if (isDangerousOut(OUT)) {
  console.error(`refusing to use '${OUT}' as the dogfood outDir — it would recursively delete an important directory. Pass a dedicated scratch path (default: /tmp/lyhna-dogfood).`);
  process.exit(2);
}

const FS_WRITE = "mcp__filesystem__write_file";
const FS_READ = "mcp__filesystem__read_file";
const TEST = "mcp__test_runner__run_tests";
const LINT = "mcp__eslint__lint";
const GIT_BRANCH = "mcp__git__create_branch";
const GIT_COMMIT = "mcp__git__commit";
const GH_PR = "mcp__github__create_pull_request";
const GMAIL_SEND = "mcp__gmail__send";
const GMAIL_DRAFT = "mcp__gmail__create_draft";
const DB_MIGRATE = "mcp__database__migrate";
const PAY_REFUND = "mcp__payments__refund";
const FS_DELETE = "mcp__filesystem__delete_file";
const ZAPIER_GDOCS = "mcp__zapier__execute_zapier_google_docs_action";

const cls = (...t) => Object.fromEntries(t.map((x) => [x, "act"]));

// Each loop: a driver scenario + a human "what this is" note. A loop may be a chain of >1 scenario
// (the continuation handoff), rendered as sub-receipts a/b.
const loops = [
  {
    id: "01-file-edit-and-test",
    note: "Real work: agent patches a checkout rounding bug and runs the suite. Both witnessed + claimed.",
    scenario: {
      id: "df-edit-test", objective: "Fix the checkout rounding bug and run the tests",
      calls: [{ toolName: FS_WRITE, arguments: { path: "src/checkout/total.ts" } }, { toolName: TEST, arguments: { suite: "checkout" } }],
      claims: [
        { system: "filesystem", action: "write_file", result: "patched the rounding in total.ts" },
        { system: "test_runner", action: "run_tests", result: "checkout suite green" }
      ],
      classMap: cls(FS_WRITE, TEST), settled: ["checkout rounding patched"]
    }
  },
  {
    id: "02-claimed-send-only-draft",
    note: "The signature catch: agent says it emailed the client, but the witness only saw a draft created.",
    scenario: {
      id: "df-draft-not-send", objective: "Send the client the weekly summary",
      calls: [{ toolName: GMAIL_DRAFT, arguments: { to: "client@acme.com" } }],
      claims: [{ system: "gmail", action: "send", result: "sent the client the weekly summary", user_facing: true }],
      classMap: cls(GMAIL_DRAFT)
    }
  },
  {
    id: "03-github-pr-task",
    note: "Real PR-style task: branch, commit, open PR. All three witnessed + claimed.",
    scenario: {
      id: "df-pr", objective: "Open a PR for the rounding fix",
      calls: [
        { toolName: GIT_BRANCH, arguments: { name: "fix/rounding" } },
        { toolName: GIT_COMMIT, arguments: { message: "fix rounding" } },
        { toolName: GH_PR, arguments: { title: "Fix checkout rounding" } }
      ],
      claims: [
        { system: "git", action: "create_branch", result: "branched fix/rounding" },
        { system: "git", action: "commit", result: "committed the fix" },
        { system: "github", action: "create_pull_request", result: "opened the PR" }
      ],
      classMap: cls(GIT_BRANCH, GIT_COMMIT, GH_PR), next_actions: ["request review on the PR"]
    }
  },
  {
    id: "04-failed-tool-call",
    note: "A migration that errors: the tool ran but failed. Must read as unsupported, not done.",
    scenario: {
      id: "df-failed-migrate", objective: "Run the pending DB migration",
      calls: [{ toolName: DB_MIGRATE, arguments: { to: "2026_06_15" } }],
      claims: [{ system: "database", action: "migrate", result: "migrated to 2026_06_15", user_facing: true }],
      failTools: [DB_MIGRATE], classMap: cls(DB_MIGRATE)
    }
  },
  {
    id: "05-approval-and-refusal",
    note: "A refund held for human approval (escalated) and a delete blocked (refused). Neither executed.",
    scenario: {
      id: "df-approval-refusal", objective: "Refund the client and clean up the old record",
      calls: [{ toolName: PAY_REFUND, arguments: { amount: 4200 } }, { toolName: FS_DELETE, arguments: { path: "/billing/old.csv" } }],
      claims: [
        { system: "payments", action: "refund", result: "refunded the client $42", user_facing: true },
        { system: "filesystem", action: "delete_file", result: "removed the stale billing file" }
      ],
      toolOutcomes: { [PAY_REFUND]: "ESCALATED", [FS_DELETE]: "REFUSED" },
      classMap: cls(PAY_REFUND, FS_DELETE)
    }
  },
  {
    id: "06-route-mismatch",
    note: "Agent claims Google Docs directly; the witness saw a Zapier wrapper (content-blind → unverified).",
    scenario: {
      id: "df-mismatch", objective: "Create the client doc in Google Docs",
      calls: [{ toolName: ZAPIER_GDOCS, arguments: { app: "google_docs", action: "create_document" } }],
      claims: [{ system: "google_docs", action: "create_document", result: "made the doc in Google Docs", user_facing: true }],
      classMap: cls(ZAPIER_GDOCS)
    }
  },
  {
    id: "07-okf-pam-export-showcase",
    note: "Mixed realistic loop (2 supported + 1 unwitnessed user-facing claim) — the OKF + PAM export showcase.",
    scenario: {
      id: "df-export", objective: "Fix the bug, run tests, and tell the client it's done",
      calls: [{ toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
      claims: [
        { system: "filesystem", action: "write_file", result: "patched the bug" },
        { system: "test_runner", action: "run_tests", result: "all green" },
        { system: "gmail", action: "send", result: "told the client it's done and shipped", user_facing: true }
      ],
      classMap: cls(FS_WRITE, TEST), settled: ["bug patched"], open_questions: ["did the client want a changelog?"]
    }
  },
  {
    id: "08-continuation-handoff",
    note: "Two-agent handoff: loop A leaves an unsent email (not safe); loop B actually sends it (witnessed). The continuation must stay honest across the boundary.",
    chain: [
      {
        id: "df-handoff-a", objective: "Fix the bug and email the client",
        calls: [{ toolName: FS_WRITE, arguments: {} }],
        claims: [
          { system: "filesystem", action: "write_file", result: "patched the bug" },
          { system: "gmail", action: "send", result: "emailed the client", user_facing: true }
        ],
        classMap: cls(FS_WRITE)
      },
      {
        id: "df-handoff-b", objective: "Continue: actually send the client email the prior agent only claimed",
        calls: [{ toolName: GMAIL_SEND, arguments: { to: "client@acme.com" } }],
        claims: [{ system: "gmail", action: "send", result: "sent the client the update", user_facing: true }],
        classMap: cls(GMAIL_SEND), settled: ["bug patched (carried from prior handoff)"]
      }
    ]
  },
  {
    id: "09-out-of-order-claim-stress",
    note: "Known v1 limitation under real pressure: an unwitnessed user-facing claim recorded mid-sequence. Must FAIL SAFE (no false-safe, email never reads supported).",
    scenario: {
      id: "df-out-of-order", objective: "Fix, email the client, then run tests",
      calls: [{ toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
      claims: [
        { system: "filesystem", action: "write_file", result: "patched the bug" },
        { system: "gmail", action: "send", result: "emailed the client mid-way", user_facing: true },
        { system: "test_runner", action: "run_tests", result: "ran the suite" }
      ],
      classMap: cls(FS_WRITE, TEST)
    }
  },
  {
    id: "10-clean-safe-to-continue",
    note: "Happy path: read, format, lint — all witnessed + claimed + supported. Safe to continue.",
    scenario: {
      id: "df-clean", objective: "Format and lint the module",
      calls: [{ toolName: FS_READ, arguments: {} }, { toolName: FS_WRITE, arguments: {} }, { toolName: LINT, arguments: {} }],
      claims: [
        { system: "filesystem", action: "read_file", result: "read the module" },
        { system: "filesystem", action: "write_file", result: "formatted the module" },
        { system: "eslint", action: "lint", result: "no lint errors" }
      ],
      classMap: cls(FS_READ, FS_WRITE, LINT), settled: ["module formatted + lint clean"]
    }
  }
];

function writeArtifacts(dir, witnessInput, rendered) {
  // Clear ONLY this loop's own subdirectory (a path we created, named by the loop id) so a re-run is
  // fresh — never the whole OUT. The runner does not wholesale-delete the user-supplied OUT.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "witness-input.json"), JSON.stringify(witnessInput, null, 2) + "\n");
  writeFileSync(join(dir, "handoff.json"), JSON.stringify(rendered.handoff, null, 2) + "\n");
  writeFileSync(join(dir, "HANDOFF.md"), rendered.md);
  writeFileSync(join(dir, "next-ai-prompt.md"), rendered.prompt);
  for (const [rel, content] of Object.entries(rendered.okf)) {
    const fp = join(dir, "okf", rel);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, content);
  }
  mkdirSync(join(dir, "pam"), { recursive: true });
  for (const [rel, content] of Object.entries(rendered.pam.files)) {
    writeFileSync(join(dir, "pam", rel), content);
  }
}

function summarize(rendered) {
  const h = rendered.handoff;
  return {
    safe_to_continue: h.safe_to_continue,
    summary: h.summary,
    steps: h.steps.map((s) => ({ n: s.index + 1, claimed: s.claimed?.system ?? null, witnessed: s.witnessed?.system ?? null, labels: s.labels }))
  };
}

async function main() {
  const { runScenario } = await import(pathToFileURL(DRIVER).href);
  // Create OUT if needed, but never recursively delete it — each loop clears only its own subdir (see
  // writeArtifacts). This removes any wholesale delete of the user-supplied path.
  mkdirSync(OUT, { recursive: true });
  const log = [];

  for (const loop of loops) {
    const entry = { id: loop.id, note: loop.note };
    const scenarios = loop.chain ?? [loop.scenario];
    entry.parts = [];
    for (let i = 0; i < scenarios.length; i++) {
      const part = scenarios[i];
      const suffix = loop.chain ? `-${"ab"[i]}` : "";
      const { witnessInput, sealed, exportRc } = await runScenario(part);
      const rendered = renderAll(witnessInput);
      const dir = join(OUT, loop.id + suffix);
      writeArtifacts(dir, witnessInput, rendered);
      entry.parts.push({ part: part.id, sealed, exportRc, dir, ...summarize(rendered) });
      console.log(`✓ ${loop.id}${suffix}  safe=${rendered.handoff.safe_to_continue}  [${rendered.handoff.steps.map((s) => s.labels.join("|")).join("  ")}]`);
    }
    log.push(entry);
  }

  writeFileSync(join(OUT, "dogfood-results.json"), JSON.stringify(log, null, 2) + "\n");
  console.log(`\nartifacts + dogfood-results.json → ${OUT}`);
}

main().catch((e) => {
  console.error("DOGFOOD FATAL:", e && e.stack ? e.stack : e);
  process.exit(1);
});
