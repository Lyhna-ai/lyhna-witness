# Install Friction Report

> **Verdict: a private-beta install is real and works today; a true one-command public install does
> not yet exist — and the docs are honest about that.** The proxy half is npm-published
> (`npx -y @lyhna/mcp`) and can wrap a real upstream MCP server from a single `.mcp.json` block. The
> single biggest friction is that the **receipt-render half (`lyhna-witness`) is not on npm** — rendering
> the AI Work Receipt requires a source clone today. This report separates what works today (A), the
> guided private beta (B), and the future one-command public install (C), and lists the exact packaging
> steps. No fake npm/install claims were added; the one recommended copy change to the live install page
> is flagged for owner sign-off rather than made unilaterally.
>
> _Audited 2026-06-16 across `lyhna-mcp-proxy` (README, RUNNING.md, docs/QUICKSTART.md) and
> `lyhna-witness` (README, web/install.html). npm publication checked live._

---

## 1. Objective

Move toward a "three clicks / one command / agent-followable" install without lying about what exists
today. Audit current install docs + the site install page, enumerate every manual step a stranger must
do, and split into: **A. works today**, **B. guided private beta**, **C. future one-command public
install**. Implement a small packaging improvement only if it is safe; otherwise write the exact plan.

## 2. Ground truth — what is actually published

Verified on 2026-06-16 from an npm client with confirmed public-registry access (`npm ping` → PONG; a
known-public control package `left-pad@1.3.0` resolved):

| Package | Status (verified) | Consequence |
| --- | --- | --- |
| `@lyhna/mcp` (the proxy) | **Published, v0.2.5 — publicly resolvable** | `npx -y @lyhna/mcp …` works today (proxy, ctl, export-pack, push-pack). |
| `lyhna-verify` (offline verifier) | **Published, v1.0.0** | `npx -y lyhna-verify --chain receipts.json` verifies a pack offline. |
| the receipt renderer (`package.json` `name: @lyhna/witness`, bin `lyhna-witness`, `private: true`) | **Not published** — both `@lyhna/witness` and the unscoped `lyhna-witness` return 404, and `private: true` would make npm refuse to publish as-is | The AI Work Receipt (`HANDOFF.md`/OKF/PAM) can only be rendered from a **source clone** (`node src/cli.mjs …`). |

So two of the three CLIs a stranger needs are already on npm and publicly installable; the **receipt
renderer is the real gap.**

> **Verification note.** These statuses are from a working npm client, confirmed against the `left-pad`
> control. A *blocked* environment (no registry tunnel) returns 403 even for public packages — that is an
> environment artifact, **not** evidence that a package is private or beta-gated, so a 403 from a sandboxed
> CI/review environment is not a publication-status signal. The invite gate that *does* exist applies to
> **signed receipts** (the hosted API key from the lyhna.com dashboard), not to the npm packages above; the
> offline `demo` bind mode needs no key (receipts are unsigned).

## 3. Every manual step a stranger must do today (signed path)

1. Have **Node 20+**.
2. Get a **Lyhna API key** from the lyhna.com dashboard — *invite-gated during the private beta*.
   (Offline alternative: skip the key and set `LYHNA_PROXY_BIND_MODE=demo` — works fully unattended, but
   receipts are deliberately **unsigned** and `lyhna-verify` reports `all_receipts_verified:false`.)
3. **Wrap your upstream MCP server** through the proxy — one config block (Claude Code / any MCP client)
   per the proxy's `docs/QUICKSTART.md` Path A, e.g. `command: npx`, `args: ["-y","@lyhna/mcp","stdio"]`,
   pointing `LYHNA_PROXY_UPSTREAM_COMMAND` / `LYHNA_PROXY_UPSTREAM_ARGS_JSON` at the real upstream.
   (`@lyhna/mcp` is publicly installable, so this `npx` block works today.)
4. For the full capsule trio (scope capsule, attested refusals, judgment ledger) use **Path B**: start
   the standing proxy with a supervisor control channel (`LYHNA_PROXY_CONTROL_SOCKET` / `_CONTROL_PORT`).
5. **Open a loop** over the supervisor control channel (newline-delimited JSON: `{"cmd":"open",…}`).
6. Run the agent task (the agent holds only the per-session URL `/mcp/<session_id>`).
7. **Close the loop** (`{"cmd":"close",…}` / SIGTERM) to seal the chain.
8. **`export-pack`** → the proof pack, including `witness-input.json`.
9. **Clone `lyhna-witness`** (no npm) → `node src/cli.mjs <witness-input.json> <outDir> --okf --pam`.
10. Read `HANDOFF.md` (and `okf/`, `pam/`).

**Friction points, ranked:**
- **(High) Step 9 — clone required.** No `npx lyhna-witness`. The receipt — the actual product the buyer
  reads — is the one artifact you can't get without a git clone and repo layout knowledge.
- **(High) Step 2 — invite + dashboard.** Signed receipts need a key from a dashboard that lives in
  Lyhna Core (out of this session's scope). The offline demo path removes this but yields unsigned proof.
- **(Medium) Steps 4–7 — supervisor control channel is manual.** Opening/closing loops is hand-written
  JSON over a socket. Powerful, but not "three clicks."
- **(Low) Cross-platform.** RUNNING.md is PowerShell-first; QUICKSTART.md does give POSIX + PowerShell
  for the key paths, so this is mostly a RUNNING.md emphasis issue.
- **(Low) Site mismatch.** `web/install.html` shows only the witness CLI step and frames setup as
  "guided," and does **not** mention the already-published `npx -y @lyhna/mcp` path or the offline demo
  mode. It undersells what works today on the proxy side. (See §6 — owner copy decision.)

## 4. A — works today (no fix needed)

A capable stranger can, **today, with no invite**, get a full unsigned receipt end to end:

- `npx -y @lyhna/mcp` (publicly installable) as the gate, `LYHNA_PROXY_BIND_MODE=demo` (no key),
  wrapping `@modelcontextprotocol/server-filesystem` (or any MCP server) via a config block or the
  terminal Path B.
- Drive a loop, `export-pack` → `witness-input.json`.
- **Clone `lyhna-witness`** (not on npm), `node src/cli.mjs … --okf --pam` → the AI Work Receipt + OKF + PAM.
- `npx -y lyhna-verify` to verify the pack offline.

This is exactly the LANE 1 topology, which ran end to end (see `LIVE-MCP-RUN-REPORT.md`). It works — it is
just not one command, and the **one step that needs a source clone is the receipt render** (the witness
CLI isn't published). The invite gate is only for *signed* receipts (the API key), not for any step above.

## 5. B — guided private beta (the honest current offer)

- **Signed** receipts via `LYHNA_API_KEY` (hosted bind at `api.lyhna.com`); the signing key never leaves
  Lyhna's servers, only its public half travels in each receipt (verify needs no account).
- Supervisor isolation per `docs/PRODUCTION-ISOLATION.md` (the agent must not be able to signal/kill the
  proxy or reach the control channel).
- "Guided" is the honest word: a human helps with the key, the upstream wiring, and the receipt render.
  This is what `web/install.html` already promises, and it is accurate.

## 6. C — future one-command public install (the plan, not yet built)

In priority order, each item is a discrete, shippable step. **None of these should be claimed on any
buyer surface until actually implemented.**

1. **Publish the witness renderer to npm** (the single highest-leverage fix — it is the only CLI in the
   path not yet published). Two prerequisite decisions, because the package is **not publish-ready as-is**:
   its `package.json` is `name: "@lyhna/witness"`, `version: 0.0.1`, and **`private: true`** (which makes
   npm refuse to publish). Publishing requires (a) removing `private: true`, and (b) choosing the public
   name. The render command then depends on that name: if published under the scoped name it is
   `npx -y @lyhna/witness <witness-input.json> <outDir> --okf --pam` (the `lyhna-witness` bin runs); to get
   the unscoped `npx -y lyhna-witness`, publish under the unscoped name instead. Either way, no clone.
   Zero-dep, Node ≥20, so packaging itself is low-risk. *Requires npm credentials + an owner name/publish
   decision — not done here.*
2. **A one-shot "render from a closed loop" path.** Either `@lyhna/mcp export-pack --render-receipt`
   (proxy shells the published witness CLI after export) or a thin `npx @lyhna/mcp receipt <packDir>`
   wrapper. Turns steps 8–10 into one command.
3. **A guided `init` for the `.mcp.json` block** (`npx @lyhna/mcp init`) that writes the config block for
   a named upstream, so step 3 is a prompt, not hand-edited JSON.
4. **Self-serve key issuance** (Lyhna Core, out of scope here) to remove the invite gate for a public
   beta — the precondition for dropping "private beta / invite-only" from the install page.
5. **Then, and only then,** update `web/install.html` to a real one-command flow and drop the "guided,
   not one-command" caveat.

## 7. What this report changed

- **No code shipped.** The one safe, high-value packaging change (publishing the witness renderer) is a
  publish action gated on npm credentials, a name decision, and removing `private: true` — an owner call;
  it is written up in §6.1 rather than done unilaterally. No fake npm/install claims were introduced
  anywhere.
- **One recommended copy change, flagged for the owner (not made):** `web/install.html` could honestly
  mention the published `npx -y @lyhna/mcp` proxy path and the offline `demo` mode that work today,
  **without** adding any one-command-for-the-whole-thing or lyhna.com claim (still owner-held). Because
  the install page is owner-held copy, this is left as a recommendation.

## 8. Honest limits

- The dashboard/key-issuance and `api.lyhna.com` live in **Lyhna Core**, which is not in this session's
  scope, so the signed-path steps are documented from the proxy's own docs, not exercised end to end here.
- "Three clicks" is not achievable without §6.1 (publish the witness) at minimum; the report deliberately
  does not pretend otherwise.
