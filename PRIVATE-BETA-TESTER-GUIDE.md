# Lyhna — Private Beta Tester Guide

Welcome, and thank you for testing Lyhna. This is the everything-you-need page for an invited beta
tester. It should take **15–20 minutes** to run one witnessed task and send us back a receipt. If
anything here is wrong, confusing, or overclaims — that is exactly the feedback we want.

> **Lyhna in one line:** AI Work Receipts your clients can trust. Lyhna witnesses what your agent's tools
> actually did, compares it to what the agent *claimed*, and prints an honest receipt — before anyone
> tells a client "done."

---

## 1. What Lyhna does

- Sits in your agent's **tool-call path** (as an MCP proxy) and **witnesses the real tool calls** — what
  crossed the tool boundary.
- Captures what the agent **claimed** it did.
- Prints a deterministic **AI Work Receipt** labeling each step:
  - 🟢 **SUPPORTED** — the claim matches what the witness saw.
  - 🟡 **CLAIMED_ACTUAL_MISMATCH** — the agent took a different route/action than it claimed.
  - 🔴 **UNSUPPORTED / DO_NOT_SEND** — the agent claimed something the witness never saw happen.
- Exports the receipt as a human page (`HANDOFF.md`), machine JSON (`handoff.json`), a next-agent prompt,
  and optional **OKF** (knowledge) and **PAM-shaped** (memory) bundles.

## 2. What Lyhna does NOT do

Lyhna asserts **action-level witnessed truth only**. It does **not**:

- verify the work is **correct** or good;
- confirm an email/message was actually **delivered** or received;
- judge **legal/business** sufficiency;
- predict or observe **client behavior**;
- read the model's **thoughts**, prompt, or output;
- claim anything **outside the observed tool path**.

If a step has no witnessed tool call, Lyhna says so ("no such call was seen") — it never fills the gap
with a guess. That restraint is the product.

## 3. Run one witnessed task

You have two ways in. **Start with A** if you just want to see a real receipt; do **B** to witness your
own agent.

### A. See a receipt in 60 seconds (no install)
1. Open the demo: **https://lyhna-ai.github.io/lyhna-witness/demo.html**
2. Click **Generate Witness Capsule**, watch the witnessed run, read the **Client Review AI Work
   Receipt**, and click **Copy receipt**. (This is a *replay* of a receipt that came through the real
   loop offline — not a live run.)

### B. Witness your own agent (offline, unsigned — fine for the beta)
You need **Node 20+**. The offline `demo` bind mode needs no Lyhna key.
1. Put the Lyhna proxy in front of an MCP server your agent already uses, following
   the proxy repo's `docs/QUICKSTART.md` (one MCP-client config block, or the terminal Path B). Set
   `LYHNA_PROXY_BIND_MODE=demo` to run with no key.
2. Run your agent task as normal. Have it record what it did via the `record_claim` tool (your guided
   setup enables this). The model can be anything — hosted or fully local (Ollama/Qwen/Llama).
3. Close the loop and `export-pack`. You now have a `witness-input.json`.

> Your access email tells you whether you're on the offline path (B above) or the guided signed path
> (with a key). Either is fine for sending feedback.

## 4. Export the receipt (+ OKF + PAM)

Render the receipt from your `witness-input.json` with the witness CLI (from a `lyhna-witness` checkout):

```bash
node src/cli.mjs <witness-input.json> <outDir> --okf --pam
```

You'll get, in `<outDir>`:
- `HANDOFF.md` — the human receipt (read this first)
- `handoff.json` — the machine version
- `next-ai-prompt.md` — a safe continuation prompt for the next agent
- `okf/` — the knowledge bundle
- `pam/` — the **PAM-shaped** memory bundle (every item carries its `evidence_status`)

## 5. Ask your own AI to audit the receipt

This is the test that matters most to us. Take `HANDOFF.md` (or the copied demo receipt) and paste it
into your own AI with a prompt like:

> "This is an AI Work Receipt from a tool called Lyhna. **Does it overclaim anywhere** — does it state or
> imply that any outcome was verified, that work is correct, that anything was delivered, or that it knows
> something outside the observed tool calls? Quote any line that claims more than 'this tool call crossed
> the boundary' or 'this claim had no witnessed call.'"

A good receipt survives that audit: it should only ever assert what crossed the tool boundary and where
evidence was missing. **If your AI finds an overclaim, that's a bug — please send it to us (§6).**

## 6. What to send back

Reply to your beta invite with:

1. **The receipt** — attach `HANDOFF.md` (and the `pam/` folder if you ran with `--pam`), or paste the
   copied demo receipt.
2. **Which path** you used (demo page / offline B / signed) and your **OS + Node version**.
3. **Did it overclaim?** Paste your AI's audit answer from §5 (yes/no + any flagged lines).
4. **Where did you get stuck?** Any step that was confusing, manual, or failed — be blunt. Install
   friction is a top thing we're fixing.
5. **One sentence:** would you trust this receipt in front of *your* client? Why / why not?

## 7. Known limitations (please hold us to these)

- **Action-level only.** Lyhna witnesses tool calls vs. claims — nothing about correctness or quality.
- **Outcomes not verified.** "DO_NOT_SEND" means *no witnessed call*, not "the work is wrong"; "SUPPORTED"
  means *the call crossed the boundary*, not "the result is good."
- **Claims are paired in call order.** In this beta, the agent's claims are matched to witnessed tool
  calls **in the order they were recorded**. If your agent records claims out of order relative to its
  calls, a step can be mis-attributed (it fails safe — flags rather than green-lights — but the step
  label may point at the wrong call). Record claims in the order you do the work.
- **PAM is "PAM-shaped," not conformant.** The `pam/` export is a projection in the spirit of Portable
  Agent Memory. It was validated against the published Portable AI Memory v1.0 schema and found
  **non-conformant** (see `PAM-SCHEMA-VALIDATION.md`) — treat it as Lyhna's memory projection, not a
  certified/conformant PAM file.
- **Live connectors may need approval.** Signed receipts and some upstream connectors (hosted SaaS behind
  OAuth) require a key and/or an interactive approval step; the offline `demo` path avoids this but
  produces **unsigned** receipts (`lyhna-verify` will report `all_receipts_verified: false`).

## 8. Getting help

Reply to your invite thread. Fastest useful bug report: the receipt + your AI's overclaim audit + the
exact step where you got stuck. Thank you — you're helping us keep Lyhna honest.
