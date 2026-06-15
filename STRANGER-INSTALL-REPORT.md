# Lyhna — Fresh Stranger Install Report

> Lane 1 of "testing in earnest." A fresh agent with **no project memory**, working in an isolated temp
> workspace from a copy of both repos, using **only the written docs**, tried to install Lyhna and
> produce one witnessed receipt + OKF + PAM. Run 2026-06-15.

## Verdict: PARTIAL → (blocker now fixed)

A stranger **could** install, build, run one witnessed loop, and get the handoff trio
(`HANDOFF.md` / `handoff.json` / `next-ai-prompt.md`) from documented commands. They **could not** emit
the **OKF** or **PAM** bundles from any user-facing command — those were only produced by an internal,
fixed-output demo script, even though the README sells them as headline features.

**Resolution (this phase):** the witness CLI now takes `--okf` / `--pam`
(`node src/cli.mjs <input> <outDir> --okf --pam`), and the README documents it. The biggest blocker is
closed; the remaining items below are doc frictions.

## What worked (docs alone)
- `npm install` + `npm run demo` in the proxy: clean; auto-builds `dist`; emits the LoopProofBundle with
  the documented "structural pass, crypto fail-by-absence" outcome.
- `npm run demo:live-loop` (proxy) emits `examples/live-loop/witness-input.json` and prints the exact
  next command. That file is **byte-identical** to the witness repo's vendored copy — the cross-repo
  loop genuinely connects.
- The witness ran with **no install** (zero-dep confirmed) and produced a correct verdict line.
- Regenerating `examples/live-loop/` produced **zero git drift** — the stranger's output matches what ships.
- Receipt comprehension is strong (see below).

## Friction log
1. **BLOCKER — OKF/PAM had no user-runnable command.** The public CLI wrote only the trio; OKF/PAM were
   reachable only via the internal `npm run demo:live-loop` (hardcoded output dir) or by writing your own
   Node script. → **Fixed:** `--okf` / `--pam` flags added to the CLI + documented.
2. **FRICTION (docs) — the proxy README quick-start points at the wrong artifact.** `npm run demo`
   produces the LoopProofBundle (receipts/bundle/graph-node), not the AI Work Receipt. Nothing in the
   proxy README points to `demo:live-loop` + the witness render; the stranger had to read
   `lyhna-witness/LLM-CONTEXT.md` §4 to find the correct two-repo sequence. → recommend a proxy README
   pointer (tracked for a docs PR).
3. **FRICTION (docs) — two `npm run demo:live-loop` collide across repos** (proxy = emit input, witness =
   render), and the witness demo renders a **vendored** copy, not the freshly-emitted proxy file (the
   "refresh" step lives only in a code comment). Harmless when they match; silently renders stale data if
   the scenario changes. → recommend documenting the refresh + disambiguating the script names.
4. **NIT — `RUNNING.md` is PowerShell/Windows-only** (`npm.cmd`, `$env:`, a hardcoded `C:\Users\Adam\…`
   path). One cross-platform line exists; the examples don't follow it.
5. **NIT — `npm install` reports 5 advisories** (proxy). Not blocking; undocumented.

## Receipt comprehension (Q5)
A non-expert can read it. The verdict line, the per-step "Agent claimed / Witness saw / no evidence"
framing, the "Safe Continuation" section, and the honesty-ceiling footer make clear what's proven vs.
unsafe to send. Quoted from the canonical receipt:
- "⛔ NOT safe to continue / send yet … 2 supported · 0 mismatches · 1 unsupported · 1 do-not-send"
- "Agent claimed: send in gmail / Witness saw: nothing observed / … there is no evidence it actually happened."
- "Lyhna witnesses what crossed the tool boundary and compares it to the agent's claims. It does not
  judge whether the work was good, and does not verify outcomes outside the observed path."

Only nit: a step can stack three labels (`UNSUPPORTED NEEDS_EVIDENCE DO_NOT_SEND`) with no inline
glossary; the plain-English note underneath compensates.

## Q1–Q6
- Q1 install/build from docs: **Yes** (Node ≥20; `npm run demo` also silently needs network/git for a
  cold-verify leg — not called out).
- Q2 one witnessed loop from docs: **Yes** (proxy `demo:live-loop` → witness CLI).
- Q3 handoff trio: **Yes** (documented CLI).
- Q4 OKF + PAM from documented commands: **was No → now Yes** (`--okf` / `--pam`).
- Q5 non-expert comprehension: **Yes**.
- Q6 two repos → receipt + OKF + PAM from docs alone: **was PARTIAL → now reachable**; remaining gaps are
  doc frictions (#2–#5), not blockers.

## Top fixes
1. ✅ **Give the witness CLI an OKF/PAM emit path** — done in this PR (`--okf` / `--pam`).
2. ⏳ **Fix the proxy README quick-start to point at the receipt** (not just the LoopProofBundle).
3. ⏳ **Document the vendored-input refresh + disambiguate the duplicate `demo:live-loop`; make RUNNING.md
   cross-platform.**
