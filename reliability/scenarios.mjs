// Lyhna Reliability Gauntlet — the scenario matrix.
//
// Each scenario is driven through the REAL proxy loop (scripts/gauntlet/driver.mjs in lyhna-mcp-proxy)
// to emit a witness-input.json, which is then rendered + asserted by gauntlet-lib.mjs. The four
// categories mirror the gauntlet brief:
//
//   1. clean supported loops      — every claim matches a witnessed, successful call ⇒ SAFE.
//   2. claimed-but-not-witnessed  — a claimed (often user-facing) action with no tool call ⇒ DO_NOT_SEND.
//   3. mismatch / path            — claimed route/action differs from what the witness saw ⇒ MISMATCH.
//   4. failure / approval / pairing — failed call, approval-gated (escalated) call, unclaimed observed
//                                     failure, and an ordinal-pairing edge — all must FAIL SAFE.
//
// `expect` is the gauntlet's ground truth, derived from src/labels.mjs by hand. `expect.steps` is
// index-aligned to the FINAL handoff step order (claims pair to turns by ordinal; unmatched turns
// append last). Some scenarios assert only the safety property (where exact attribution is a known v1
// limitation, not a truth break) — those carry a `note`.

// Tool names are MCP-namespaced (mcp__<server>__<tool>) so the witness derives system+action from the
// wire name. Every CALLED tool needs a classMap entry, or the scope gate refuses it.
const FS_WRITE = "mcp__filesystem__write_file";
const FS_READ = "mcp__filesystem__read_file";
const TEST = "mcp__test_runner__run_tests";
const GIT = "mcp__git__commit";
const DB = "mcp__database__query";
const HTTP = "mcp__http__get";
const NOTION = "mcp__notion__create_page";
const SHOPIFY = "mcp__shopify__update_product";
const GMAIL_SEND = "mcp__gmail__send";
const GMAIL_DRAFT = "mcp__gmail__create_draft";
const PAYMENTS_REFUND = "mcp__payments__refund";
const ZAPIER_GDOCS = "mcp__zapier__execute_zapier_google_docs_action";

// Map a list of called tools to a single permissive action class (these scenarios exercise verdicts
// and claims, not target/scope shape).
const cls = (...tools) => Object.fromEntries(tools.map((t) => [t, "act"]));

const SUPPORTED = ["SUPPORTED"];
const NO_FLAGS = ["UNSUPPORTED", "DO_NOT_SEND", "CLAIMED_ACTUAL_MISMATCH", "NEEDS_HUMAN_APPROVAL"];

export const scenarios = [
  // ---------------- Category 1 — clean supported loops (10) ----------------
  {
    id: "c1-fs-write", category: "1-clean-supported",
    objective: "Patch the checkout rounding bug",
    calls: [{ toolName: FS_WRITE, arguments: { path: "/checkout/total.ts" } }],
    claims: [{ system: "filesystem", action: "write_file", result: "patched the rounding bug" }],
    classMap: cls(FS_WRITE),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-test", category: "1-clean-supported",
    objective: "Run the checkout test suite",
    calls: [{ toolName: TEST, arguments: { suite: "checkout" } }],
    claims: [{ system: "test_runner", action: "run_tests", result: "all tests pass" }],
    classMap: cls(TEST),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-git-commit", category: "1-clean-supported",
    objective: "Commit the fix",
    calls: [{ toolName: GIT, arguments: { message: "fix" } }],
    claims: [{ system: "git", action: "commit" }],
    classMap: cls(GIT),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-db-query", category: "1-clean-supported",
    objective: "Read the order row",
    calls: [{ toolName: DB, arguments: { sql: "select 1" } }],
    claims: [{ system: "database", action: "query" }],
    classMap: cls(DB),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-http-get", category: "1-clean-supported",
    objective: "Fetch the status page",
    calls: [{ toolName: HTTP, arguments: { url: "https://example.com" } }],
    claims: [{ system: "http", action: "get" }],
    classMap: cls(HTTP),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-two-step", category: "1-clean-supported",
    objective: "Write the fix and run tests",
    calls: [{ toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
    claims: [{ system: "filesystem", action: "write_file" }, { system: "test_runner", action: "run_tests" }],
    classMap: cls(FS_WRITE, TEST),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }, { include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-three-step", category: "1-clean-supported",
    objective: "Read, write, test",
    calls: [{ toolName: FS_READ, arguments: {} }, { toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
    claims: [{ system: "filesystem", action: "read_file" }, { system: "filesystem", action: "write_file" }, { system: "test_runner", action: "run_tests" }],
    classMap: cls(FS_READ, FS_WRITE, TEST),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }, { include: SUPPORTED, exclude: NO_FLAGS }, { include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-system-only-claim", category: "1-clean-supported",
    objective: "Create a page (claim omits the action)",
    calls: [{ toolName: NOTION, arguments: {} }],
    claims: [{ system: "notion" }], // no action ⇒ no action mismatch ⇒ SUPPORTED
    classMap: cls(NOTION),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-shopify", category: "1-clean-supported",
    objective: "Update the product",
    calls: [{ toolName: SHOPIFY, arguments: {} }],
    claims: [{ system: "shopify", action: "update_product" }],
    classMap: cls(SHOPIFY),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },
  {
    id: "c1-result-claim", category: "1-clean-supported",
    objective: "Write the file (claim states a result)",
    calls: [{ toolName: FS_WRITE, arguments: {} }],
    claims: [{ system: "filesystem", action: "write_file", result: "done" }], // witness sets no result on success ⇒ no mismatch
    classMap: cls(FS_WRITE),
    expect: { safe_to_continue: true, steps: [{ include: SUPPORTED, exclude: NO_FLAGS }] }
  },

  // ---------------- Category 2 — claimed but not witnessed (10) ----------------
  {
    id: "c2-email-only", category: "2-claimed-not-witnessed",
    objective: "Email the client the invoice",
    calls: [],
    claims: [{ system: "gmail", action: "send", result: "emailed the client the invoice", user_facing: true }],
    classMap: {},
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-fix-then-email", category: "2-claimed-not-witnessed",
    objective: "Patch the bug, then email the client",
    calls: [{ toolName: FS_WRITE, arguments: {} }],
    claims: [{ system: "filesystem", action: "write_file" }, { system: "gmail", action: "send", result: "emailed the client", user_facing: true }],
    classMap: cls(FS_WRITE),
    expect: { safe_to_continue: false, steps: [{ include: SUPPORTED }, { include: ["UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-share-doc", category: "2-claimed-not-witnessed",
    objective: "Share the doc with the client",
    calls: [],
    claims: [{ system: "google_drive", action: "share", result: "shared with the client", user_facing: true }],
    classMap: {},
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-sms", category: "2-claimed-not-witnessed",
    objective: "Text the client a confirmation",
    calls: [],
    claims: [{ system: "twilio", action: "send_sms", result: "texted the client", user_facing: true }],
    classMap: {},
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-canonical-mix", category: "2-claimed-not-witnessed",
    objective: "Fix checkout, run tests, email the client (the canonical mixed receipt)",
    calls: [{ toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
    claims: [
      { system: "filesystem", action: "write_file", result: "patched the rounding bug" },
      { system: "test_runner", action: "run_tests", result: "all tests pass" },
      { system: "gmail", action: "send", result: "emailed the client the corrected invoice", user_facing: true }
    ],
    classMap: cls(FS_WRITE, TEST),
    expect: { safe_to_continue: false, steps: [{ include: SUPPORTED }, { include: SUPPORTED }, { include: ["UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-invoice", category: "2-claimed-not-witnessed",
    objective: "Patch the file, then invoice the client",
    calls: [{ toolName: FS_WRITE, arguments: {} }],
    claims: [{ system: "filesystem", action: "write_file" }, { system: "quickbooks", action: "send_invoice", result: "invoiced the client", user_facing: true }],
    classMap: cls(FS_WRITE),
    expect: { safe_to_continue: false, steps: [{ include: SUPPORTED }, { include: ["UNSUPPORTED", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-unwitnessed-internal", category: "2-claimed-not-witnessed",
    objective: "Sync internal state (claimed, not witnessed, NOT user-facing)",
    calls: [],
    claims: [{ system: "internal_api", action: "sync" }], // not user_facing ⇒ UNSUPPORTED but NOT DO_NOT_SEND
    classMap: {},
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "NEEDS_EVIDENCE"], exclude: ["DO_NOT_SEND"] }] }
  },
  {
    id: "c2-two-unwitnessed", category: "2-claimed-not-witnessed",
    objective: "Email and Slack the client (both claimed, neither witnessed)",
    calls: [],
    claims: [
      { system: "gmail", action: "send", user_facing: true },
      { system: "slack", action: "post_message", user_facing: true }
    ],
    classMap: {},
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "DO_NOT_SEND"] }, { include: ["UNSUPPORTED", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-posted-update", category: "2-claimed-not-witnessed",
    objective: "Post the client update",
    calls: [],
    claims: [{ system: "linkedin", action: "post", result: "posted the update", user_facing: true }],
    classMap: {},
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "DO_NOT_SEND"] }] }
  },
  {
    id: "c2-confirmed-client", category: "2-claimed-not-witnessed",
    objective: "Fix, test, and confirm with the client",
    calls: [{ toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
    claims: [
      { system: "filesystem", action: "write_file" },
      { system: "test_runner", action: "run_tests" },
      { system: "gmail", action: "send", result: "confirmed completion with the client", user_facing: true }
    ],
    classMap: cls(FS_WRITE, TEST),
    expect: { safe_to_continue: false, steps: [{ include: SUPPORTED }, { include: SUPPORTED }, { include: ["UNSUPPORTED", "DO_NOT_SEND"] }] }
  },

  // ---------------- Category 3 — mismatch / path (5) ----------------
  {
    id: "c3-system-mismatch", category: "3-mismatch",
    objective: "Send via Google (claimed) — witness saw gmail",
    calls: [{ toolName: GMAIL_SEND, arguments: {} }],
    claims: [{ system: "google", action: "send" }], // claimed system != witnessed system (gmail), route-only
    classMap: cls(GMAIL_SEND),
    // Route-only mismatch: the work may be fine, but the agent's account does not match the witnessed
    // path, so the run is NOT safe to continue (review/reconcile) — without being DO_NOT_SEND, since the
    // step is not unsupported/user-facing. (Owner ruling; THESIS §9 "review before sending".)
    expect: { safe_to_continue: false, steps: [{ include: ["CLAIMED_ACTUAL_MISMATCH"], exclude: ["UNSUPPORTED", "SUPPORTED", "DO_NOT_SEND", "NEEDS_HUMAN_APPROVAL"] }] }
  },
  {
    id: "c3-action-mismatch", category: "3-mismatch",
    objective: "Claimed it sent the email — witness saw a draft",
    calls: [{ toolName: GMAIL_DRAFT, arguments: {} }],
    claims: [{ system: "gmail", action: "send", result: "sent the client the email", user_facing: true }],
    classMap: cls(GMAIL_DRAFT),
    expect: { safe_to_continue: false, steps: [{ include: ["CLAIMED_ACTUAL_MISMATCH", "UNSUPPORTED", "DO_NOT_SEND"] }] }
  },
  {
    id: "c3-wrapper-path", category: "3-mismatch",
    objective: "Claimed Google Docs directly — witness saw a Zapier wrapper",
    calls: [{ toolName: ZAPIER_GDOCS, arguments: { app: "google_docs", action: "create_document" } }],
    claims: [{ system: "google_docs", action: "create_document", result: "made the doc" }],
    classMap: cls(ZAPIER_GDOCS),
    // content-blind: the wrapper's app/action is unreadable from the ledger ⇒ operation unverified + path mismatch.
    expect: { safe_to_continue: false, steps: [{ include: ["CLAIMED_ACTUAL_MISMATCH", "UNSUPPORTED", "NEEDS_EVIDENCE"] }] }
  },
  {
    id: "c3-wrapper-path-userfacing", category: "3-mismatch",
    objective: "Same wrapper mismatch, but the step is user-facing",
    calls: [{ toolName: ZAPIER_GDOCS, arguments: { app: "google_docs", action: "create_document" } }],
    claims: [{ system: "google_docs", action: "create_document", result: "shared the doc with the client", user_facing: true }],
    classMap: cls(ZAPIER_GDOCS),
    expect: { safe_to_continue: false, steps: [{ include: ["CLAIMED_ACTUAL_MISMATCH", "UNSUPPORTED", "NEEDS_EVIDENCE", "DO_NOT_SEND"] }] }
  },
  {
    id: "c3-result-mismatch-refused", category: "3-mismatch",
    objective: "Claimed it sent the invoice — the witness saw the call refused",
    calls: [{ toolName: GMAIL_SEND, arguments: {} }],
    claims: [{ system: "gmail", action: "send", result: "sent the invoice", user_facing: true }],
    toolOutcomes: { [GMAIL_SEND]: "REFUSED" },
    classMap: cls(GMAIL_SEND),
    expect: { safe_to_continue: false, steps: [{ include: ["CLAIMED_ACTUAL_MISMATCH", "UNSUPPORTED", "DO_NOT_SEND"] }] }
  },

  // ---------------- Category 4 — failure / approval / pairing (5) ----------------
  {
    id: "c4-failed-call", category: "4-failure-approval-pairing",
    objective: "Write the file — the tool ran but failed",
    calls: [{ toolName: FS_WRITE, arguments: {} }],
    claims: [{ system: "filesystem", action: "write_file", user_facing: true }], // no result ⇒ failure only, no result-mismatch
    failTools: [FS_WRITE],
    classMap: cls(FS_WRITE),
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "DO_NOT_SEND"], exclude: ["CLAIMED_ACTUAL_MISMATCH"] }] }
  },
  {
    id: "c4-failed-with-success-claim", category: "4-failure-approval-pairing",
    objective: "Claimed it wrote the file — the witness saw the call error",
    calls: [{ toolName: FS_WRITE, arguments: {} }],
    claims: [{ system: "filesystem", action: "write_file", result: "wrote the file", user_facing: true }],
    failTools: [FS_WRITE],
    classMap: cls(FS_WRITE),
    // claimed result "wrote the file" vs witnessed "error" ⇒ also a mismatch.
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED", "DO_NOT_SEND", "CLAIMED_ACTUAL_MISMATCH"] }] }
  },
  {
    id: "c4-escalated", category: "4-failure-approval-pairing",
    objective: "Refund the client — the call was escalated for human approval",
    calls: [{ toolName: PAYMENTS_REFUND, arguments: {} }],
    claims: [{ system: "payments", action: "refund", result: "refunded the client", user_facing: true }],
    toolOutcomes: { [PAYMENTS_REFUND]: "ESCALATED" },
    classMap: cls(PAYMENTS_REFUND),
    expect: { safe_to_continue: false, steps: [{ include: ["NEEDS_HUMAN_APPROVAL", "UNSUPPORTED", "DO_NOT_SEND"] }] }
  },
  {
    id: "c4-no-claim-observed-failure", category: "4-failure-approval-pairing",
    objective: "An observed tool failure with no agent claim",
    calls: [{ toolName: FS_WRITE, arguments: {} }],
    claims: [], // unclaimed observed failure ⇒ UNSUPPORTED, never fabricated as a claim
    failTools: [FS_WRITE],
    classMap: cls(FS_WRITE),
    expect: { safe_to_continue: false, steps: [{ include: ["UNSUPPORTED"], exclude: ["CLAIMED_ACTUAL_MISMATCH", "DO_NOT_SEND"] }] }
  },
  {
    id: "c4-mispairing-edge", category: "4-failure-approval-pairing",
    objective: "An unwitnessed user-facing claim recorded mid-sequence (ordinal-pairing edge)",
    calls: [{ toolName: FS_WRITE, arguments: {} }, { toolName: TEST, arguments: {} }],
    claims: [
      { system: "filesystem", action: "write_file" },
      { system: "gmail", action: "send", result: "emailed the client", user_facing: true }, // no matching call
      { system: "test_runner", action: "run_tests" }
    ],
    classMap: cls(FS_WRITE, TEST),
    // Ordinal pairing scrambles attribution here (the email claim pairs with the test turn), but the
    // run MUST still fail safe: no false-SAFE, and the user-facing unwitnessed claim must never read as
    // supported. Exact per-step labels are a known v1 limitation, so only the safety property is asserted.
    note: "Ordinal mis-pairing: attribution scrambles but the run must fail safe (no false-SAFE, no laundered support).",
    expect: { safe_to_continue: false }
  }
];
