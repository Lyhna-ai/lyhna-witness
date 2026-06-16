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

Checked against the npm registry on 2026-06-16:

| Package | Status | Consequence |
| --- | --- | --- |
| `@lyhna/mcp` (the proxy) | **Published (v0.2.5) but access-gated** — a clean/unauthenticated `npm view` returns **403**, not the public 200; it resolves only from an environment with beta/registry access | `npx -y @lyhna/mcp …` works **only where the package is reachable** (beta access). It is **not** a public self-serve install yet. |
| `lyhna-verify` (offline verifier) | Published (v1.0.0), unscoped | `lyhna-verify --chain receipts.json` verifies a pack offline (subject to the same registry-reachability caveat). |
| `lyhna-witness` (the receipt renderer) | **Not published — 404** | The AI Work Receipt (`HANDOFF.md`/OKF/PAM) can only be rendered from a **source clone** (`node src/cli.mjs …`). |

So the npm packages exist but the proxy package is **access-gated during the private beta** (consistent
with the "no public one-command install" posture), and the **receipt renderer is not published at all**.
The only path that needs no registry access and no invite is a **source clone of both repos**.

## 3. Every manual step a stranger must do today (signed path)

1. Have **Node 20+**.
2. Get a **Lyhna API key** from the lyhna.com dashboard — *invite-gated during the private beta*.
   (Offline alternative: skip the key and set `LYHNA_PROXY_BIND_MODE=demo` — works fully unattended, but
   receipts are deliberately **unsigned** and `lyhna-verify` reports `all_receipts_verified:false`.)
3. **Wrap your upstream MCP server** through the proxy — one config block (Claude Code / any MCP client)
   per `docs/QUICKSTART.md` Path A, pointing `LYHNA_PROXY_UPSTREAM_COMMAND` /
   `LYHNA_PROXY_UPSTREAM_ARGS_JSON` at the real upstream. The block can run the proxy via
   `npx -y @lyhna/mcp` **where the package is reachable (beta access)**, or from a local checkout
   otherwise.
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

A capable stranger can, **today, with no invite and no registry access**, get a full unsigned receipt end
to end **from source clones**:

- Clone `lyhna-mcp-proxy`, `npm install && npm run build`; run the gate with
  `LYHNA_PROXY_BIND_MODE=demo`, wrapping `@modelcontextprotocol/server-filesystem` (or any MCP server)
  via a config block or the terminal Path B.
- Drive a loop, `export-pack` → `witness-input.json`.
- Clone `lyhna-witness`, `node src/cli.mjs … --okf --pam` → the AI Work Receipt + OKF + PAM.
- Verify the pack offline with `lyhna-verify`.

This is exactly the LANE 1 topology, which ran end to end (see `LIVE-MCP-RUN-REPORT.md`). It works — it is
just not one command, it needs two source clones, and (for the npx shortcut) the proxy package is
beta-access-gated rather than public.

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

1. **Publish `lyhna-witness` to npm** (the single highest-leverage fix). Then the receipt step becomes
   `npx -y lyhna-witness <witness-input.json> <outDir> --okf --pam` — no clone. Zero-dep, Node ≥20, so
   packaging is low-risk. *Requires npm credentials + an owner publish decision — not done here.*
1b. **Un-gate `@lyhna/mcp` (and `lyhna-verify`) for public install** — they are published but currently
   resolve only with beta/registry access (a clean `npm view` 403s). A public beta needs the proxy
   package reachable via plain `npx`. *Owner/registry decision.*
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

- **No code shipped.** The one safe, high-value packaging change (publishing `lyhna-witness`) is a
  publish action gated on npm credentials and an owner decision; it is written up in §6.1 rather than done
  unilaterally. No fake npm/install claims were introduced anywhere.
- **One recommended copy change, flagged for the owner (not made):** `web/install.html` could honestly
  mention the published `npx -y @lyhna/mcp` proxy path and the offline `demo` mode that work today,
  **without** adding any one-command-for-the-whole-thing or lyhna.com claim (still owner-held). Because
  the install page is owner-held copy, this is left as a recommendation.

## 8. Honest limits

- The dashboard/key-issuance and `api.lyhna.com` live in **Lyhna Core**, which is not in this session's
  scope, so the signed-path steps are documented from the proxy's own docs, not exercised end to end here.
- "Three clicks" is not achievable without §6.1 (publish the witness) at minimum; the report deliberately
  does not pretend otherwise.
