# Black-Box Beta Breaker Panel

> **Final verdict: GO for invited private beta.** Five independent reviewer roles (run as separate
> subagents, each blind to the others) exercised Lyhna as a stranger, a breaker, a private/local-AI buyer,
> an agency buyer, and an install-friction reviewer. The breaker found **one genuine truth break** (the
> `settled`/`do_not_re_litigate` channel rendered operator-declared text with witness-strength authority,
> incl. an unwitnessed "patched" correctness claim) — **fixed**. All other findings are doc/friction or
> owner-held web-copy polish. No remaining P1/P2 truth break ships.
>
> _Panel date: 2026-06-16. Reviewed at: lyhna-witness `main` @ `9d50a29`, lyhna-mcp-proxy `master` @
> `bbda3ba`. Roles ran as independent subagents; none saw another's conclusions._

---

## Role-by-role outcome

| Role | Pass condition | Verdict |
| --- | --- | --- |
| 1 — Fresh Stranger Install | Stranger understands the promise AND produces the receipt/exports without tribal knowledge | **PASS (with friction)** |
| 2 — Breaker / Overclaim | No P1/P2 truth break | **FAIL → FIXED** (one P1, now resolved) |
| 3 — Private / Local AI Buyer | Buyer knows when Lyhna works, when it doesn't, what must route through MCP | **PASS** (one privacy-disclosure P1, fixed in docs) |
| 4 — Agency / Client-Work Buyer | Buyer can describe it as "AI Work Receipts for client-facing agent work" and knows the output | **PASS** |
| 5 — Install Friction | Docs honest/minimal; no implied npm-published witness renderer | **PASS (one P1 dead command, fixed)** |

## Findings and disposition

### P1 — fixed
- **[ROLE 2] `settled`/`do_not_re_litigate` rendered as witnessed fact (truth break).** Caller/operator
  free text carried witness-strength authority — HANDOFF "Settled Decisions", next-ai-prompt "Treat these
  as SETTLED", OKF prompt, and PAM `evidence_status:"SETTLED"`/`"DO_NOT_RE_LITIGATE"` — with no witness
  backing. The canonical demo asserted an unwitnessed correctness outcome ("checkout total rounding bug
  patched"), contradicting PAM's own "never upgrade an unsupported claim into a fact" promise.
  **Fixed (witness #30, proxy #31):** all surfaces now state these are *operator-declared, not witnessed
  or verified by Lyhna*; PAM uses a non-witness `evidence_status: "DECLARED"`; the canonical `settled`
  text is witness-bounded ("fix written to disk and tests run (both witnessed)"). Determinism preserved;
  examples regenerated; tests updated.
- **[ROLE 5] Dead `lyhna-witness` render command in the proxy example.** `lyhna-mcp-proxy/examples/
  live-loop/README.md` told users to run a bare `lyhna-witness …`, implying an npm-published renderer
  (`@lyhna/witness` is `private:true`, 404). **Fixed (proxy #31):** `node ../lyhna-witness/src/cli.mjs …`
  with a "not published yet — run from a checkout" note.
- **[ROLE 1] The witness CLI docs reference a `witness-input.json` a stranger can't produce/find.** The
  witness `README.md` and `web/install.html` used `node src/cli.mjs <witness-input.json> …` with no
  obtainable sample in-repo and the "how to get one" bridge only in the *proxy* README.
  **Fixed (witness docs PR):** README now points at the real committed sample
  (`demo/live-loop-witness-input.json`) with a runnable command and names the proxy emit step.
- **[ROLE 3] Privacy disclosure: hosted bind receives tool arguments.** Docs said tool arguments "are not
  stored" (true of the content-blind ledger/receipt), but in **signed/hosted** mode the proxy sends each
  call's `arguments` to `api.lyhna.com/v1/bind` for the allow/deny decision — a privacy buyer could be
  misled. **Fixed (witness docs PR):** `PRIVATE-AI-INSTALL-NOTES.md` + `PRIVATE-BETA-TESTER-GUIDE.md` now
  state plainly that the receipt/ledger is content-blind (name only), signed/hosted bind sends arguments
  to Lyhna's hosted service for the decision (then not stored in the receipt), and offline `demo` mode
  sends no arguments to Lyhna (upstream tools still behave normally — outside Lyhna).

### P2 — fixed or dispositioned
- **[ROLE 1] README OKF layout mismatch.** README showed `okf/handoffs/<name>.md`; the CLI emits
  `handoffs/handoff.md`. **Fixed (witness docs PR).**
- **[ROLE 3] No harness guidance for local AI (e.g. Ollama doesn't speak MCP natively).** **Fixed
  (witness docs PR):** added an honest note that a local model needs an MCP-capable harness that routes
  its tool calls through the proxy.
- **[ROLE 2] Agent claim `result:"patched…"` appears under a SUPPORTED step in PAM.** **Intentionally not
  changed:** it is correctly namespaced under `claimed` (the agent's voice), not Lyhna's; the step's
  support is for the witnessed *call*, not the claimed result. Kept as an honest representation of an
  agent over-claiming.
- **[ROLE 5 / ROLE 4 / ROLE 2] `web/install.html` undersells what works today; homepage OKF "open spec"
  wording; OKF/PAM unexplained for non-technical buyers.** **Intentionally not changed (owner-held web
  copy):** flagged for owner sign-off. Recommended: add an honest line that the proxy is publicly
  `npx -y @lyhna/mcp`-installable + offline `demo` mode works today (no one-command/lyhna.com claim);
  soften homepage "Open Knowledge Format — an open spec" to "an open, portable knowledge format" to match
  the disciplined "PAM-shaped" hedge; add one plain-language gloss for OKF/PAM.

### P3 — noted, not fixed (avoid churn)
- `demo:live-loop` script-name collision across the two repos (proxy *emits*, witness *renders*); the
  witness renders a vendored copy. Documented in `STRANGER-INSTALL-REPORT.md`; left as-is.
- `lyhna-mcp-proxy/RUNNING.md` is PowerShell/Windows-first with a personal path; `docs/QUICKSTART.md` is
  the dual-shell path to send newcomers to.

## What each reviewer confirmed CLEAN (notable positives)
- Step labeling is leak-free: a DO_NOT_SEND step never renders as "completed"; PAM collapses a step's
  labels to the worst, never upgrades; refused/escalated are "blocked before it ran"; `safe_to_continue`
  is honest. (ROLE 2 traced `examples/live-loop` end-to-end.)
- Demo is an honest replay; the 🔴 DO-NOT-SEND "claimed it emailed the client, Lyhna saw no such call"
  moment is visceral; pricing is model-only with no fake numbers; every footer carries the action-level
  ceiling. (ROLE 4)
- Model-agnostic + MCP-routing requirement is clear; offline `demo` mode genuinely runs with no network;
  content-blindness is enforced in the data structure, not just claimed. (ROLE 3)
- `@lyhna/mcp` (v0.2.5) and `lyhna-verify` (v1.0.0) are publicly installable; the witness renderer is
  honestly source-clone-only. Shortest honest path works end to end. (ROLE 5)
- Zero-dep, deterministic, byte-identical regeneration; the cross-repo loop produces all five artifacts.
  (ROLE 1)

## PRs
- **Witness #30** (merged `e25462f`) — `settled`/`do_not_re_litigate` provenance truth fix (generator + PAM + demo
  regeneration; OKF prompt + PAM do-not-re-litigate follow-up).
- **Proxy #31** — honest live-loop `settled` text + fixed dead render command in the example README.
- **Witness docs PR (this report)** — `BLACK-BOX-BETA-PANEL.md` + ROLE 1 README fix + ROLE 3 privacy
  clarification + local-AI harness note.

_(Merge SHAs recorded in the final session report.)_

## Beta verdict
- **Invited private beta: GO.** The single truth break is fixed; no P1/P2 overclaim ships. Remaining items
  are owner-held web-copy polish and the already-documented known limitations.

## Remaining blockers for a PUBLIC beta (unchanged + panel additions)
1. **Publish the witness renderer to npm** (`@lyhna/witness` is `private:true`, unpublished) — the one CLI
   that needs a source clone today.
2. **One-shot render-from-pack path** to collapse the manual loop→render steps.
3. **Self-serve key issuance** (Lyhna Core, out of scope) to remove the invite requirement.
4. **Claim↔turn correlation** — claims pair in call order; out-of-order/system-only claims can
   mis-attribute and do **not** reliably fail safe (disclosed to testers; real fix deferred).
5. **Owner web-copy decisions** — complete the install page (mention the working `npx` proxy path +
   offline mode), and reconcile the OKF "open spec" wording.
6. **Privacy presentation for signed mode** — docs now disclose that hosted bind receives tool arguments;
   the offline `demo` path is the argument-private option. A formal compliance statement is a pre-public
   item.
