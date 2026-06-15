// Lyhna Reliability Gauntlet — render + invariant-assertion engine (witness side).
//
// For one witness-input.json (ideally produced by the REAL proxy loop), this renders the full witness
// surface — handoff.json + HANDOFF.md + next-ai-prompt.md + the OKF bundle + the PAM bundle — and then
// runs the honesty/reliability invariants the gauntlet exists to defend:
//
//   - no false-safe: any UNSUPPORTED / DO_NOT_SEND / NEEDS_HUMAN_APPROVAL step ⇒ not safe_to_continue;
//   - no laundering: an unsupported/mismatched step never reads as supported fact in OKF or PAM;
//   - DO_NOT_SEND survives into both exports;
//   - approval stays approval (surfaced, never silently dropped, never read as safe);
//   - no fabrication: a claimless (observed) step is never narrated as "the agent claimed …";
//   - every PAM memory item carries an evidence_status;
//   - determinism: the same input renders byte-identically twice.
//
// Each invariant violation is a finding with a severity (P1/P2/P3) matching the gauntlet's pass/fail
// rules. P1 = a truth break (false-safe, or an unsupported claim laundered into supported/fact).

import { runFromWitnessedEvents } from "../src/witnessed-event.mjs";
import { buildWitnessedHandoff, renderHandoffMarkdown, renderNextAiPrompt } from "../src/generate.mjs";
import { renderOkfBundle } from "../src/okf.mjs";
import { renderPamBundle } from "../src/pam.mjs";

const EVIDENCE_GAP_LABELS = ["UNSUPPORTED", "DO_NOT_SEND", "CLAIMED_ACTUAL_MISMATCH"];
// Labels that must force safe_to_continue=false. CLAIMED_ACTUAL_MISMATCH blocks per the owner ruling
// (THESIS §9: a claimed-vs-actual gap means review/reconcile before continuing).
const BLOCKING_LABELS = ["UNSUPPORTED", "DO_NOT_SEND", "NEEDS_HUMAN_APPROVAL", "CLAIMED_ACTUAL_MISMATCH"];

/** Render every witness surface from a witness-input payload. */
export function renderAll(witnessInput, { okfName = "handoff", pamName = "handoff" } = {}) {
  const handoff = buildWitnessedHandoff(runFromWitnessedEvents(witnessInput));
  const md = renderHandoffMarkdown(handoff);
  const prompt = renderNextAiPrompt(handoff);
  const okf = renderOkfBundle(handoff, { name: okfName });
  const pamFiles = renderPamBundle(handoff, { name: pamName });
  const pam = {
    manifest: JSON.parse(pamFiles["manifest.json"]),
    memories: pamFiles["memories.jsonl"].trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)),
    files: pamFiles
  };
  return { handoff, md, prompt, okf, pam };
}

// --- a deliberately small YAML-frontmatter reader for the OKF files this projector emits ------------
// okf.mjs writes scalars as JSON.stringify(String(v)) (quoted) or raw numbers/booleans, and arrays as a
// block list of `  - <scalar>` lines. We only need lyhna_labels (array), claimed_system, and
// safe_to_continue back out.
function parseFrontmatter(fileText) {
  const lines = fileText.split("\n");
  if (lines[0] !== "---") return {};
  const end = lines.indexOf("---", 1);
  const body = lines.slice(1, end === -1 ? lines.length : end);
  const out = {};
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const rest = m[2];
    if (rest === "") {
      // Possibly a block list: collect following `  - ...` lines.
      const items = [];
      let j = i + 1;
      while (j < body.length && /^\s+-\s+/.test(body[j])) {
        items.push(unscalar(body[j].replace(/^\s+-\s+/, "")));
        j++;
      }
      if (items.length) {
        out[key] = items;
        i = j - 1;
      } else {
        out[key] = "";
      }
    } else {
      out[key] = unscalar(rest);
    }
  }
  return out;
}
function unscalar(s) {
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (s.startsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  return s;
}

const labelsOf = (step) => step.labels ?? [];
const hasAny = (arr, set) => arr.some((x) => set.includes(x));
const stepSlug = (index) => `step-${String(index + 1).padStart(3, "0")}`;

/**
 * Run all invariants for one rendered scenario.
 * @param {object} scenario   the scenario spec (carries `id`, `category`, and `expect`).
 * @param {object} rendered   the output of renderAll.
 * @param {object} witnessInput  the input that was rendered (re-rendered once for the determinism check).
 * @returns {{findings:Array<{severity:string,code:string,msg:string}>, actual:object}}
 */
export function checkInvariants(scenario, rendered, witnessInput) {
  const { handoff, okf, pam } = rendered;
  const findings = [];
  const add = (severity, code, msg) => findings.push({ severity, code, msg });
  const expect = scenario.expect ?? {};

  // ---- G2: expected safe_to_continue ----
  if (expect.safe_to_continue !== undefined && handoff.safe_to_continue !== expect.safe_to_continue) {
    add("P1", "expected-safe", `safe_to_continue=${handoff.safe_to_continue}, expected ${expect.safe_to_continue}`);
  }

  // ---- G1: no false-safe ----
  const anyBlocking = handoff.steps.some((s) => hasAny(labelsOf(s), BLOCKING_LABELS));
  if (anyBlocking && handoff.safe_to_continue) {
    add("P1", "false-safe", "a step is UNSUPPORTED/DO_NOT_SEND/NEEDS_HUMAN_APPROVAL yet safe_to_continue=true");
  }
  if (!anyBlocking && handoff.safe_to_continue === false && handoff.steps.length > 0) {
    // Not necessarily a bug (e.g. all NEEDS_EVIDENCE), but worth surfacing as low severity.
    const allEvidenceOnly = handoff.steps.every((s) => labelsOf(s).every((l) => !BLOCKING_LABELS.includes(l)));
    if (allEvidenceOnly) add("P3", "conservative-unsafe", "not safe_to_continue with no blocking label present");
  }

  // ---- G3: per-step expected labels (index-aligned; we author scenarios with a known final order) ----
  if (Array.isArray(expect.steps)) {
    if (expect.steps.length !== handoff.steps.length) {
      add("P2", "step-count", `handoff has ${handoff.steps.length} steps, expectation lists ${expect.steps.length}`);
    }
    expect.steps.forEach((es, i) => {
      const step = handoff.steps[i];
      if (!step) return;
      const labels = labelsOf(step);
      for (const must of es.include ?? []) {
        if (!labels.includes(must)) add("P1", "missing-label", `step ${i + 1}: expected label ${must}, got [${labels.join(" ")}]`);
      }
      for (const not of es.exclude ?? []) {
        if (labels.includes(not)) add("P1", "forbidden-label", `step ${i + 1}: forbidden label ${not} present, got [${labels.join(" ")}]`);
      }
    });
  }

  // ---- G4: OKF does not launder ----
  const okfSafe = parseFrontmatter(okf["index.md"]).safe_to_continue;
  if (okfSafe !== handoff.safe_to_continue) {
    add("P1", "okf-safe-mismatch", `OKF index safe_to_continue=${okfSafe} != handoff ${handoff.safe_to_continue}`);
  }
  handoff.steps.forEach((s) => {
    const file = okf[`steps/${stepSlug(s.index)}.md`];
    if (!file) {
      add("P2", "okf-step-missing", `OKF missing step file for step ${s.index + 1}`);
      return;
    }
    const fm = parseFrontmatter(file);
    const okfLabels = Array.isArray(fm.lyhna_labels) ? fm.lyhna_labels : fm.lyhna_labels ? [fm.lyhna_labels] : [];
    // Every label the handoff step carries must also be in OKF — an export must not silently drop a
    // truth-bearing label (e.g. UNSUPPORTED / DO_NOT_SEND).
    for (const l of labelsOf(s)) {
      if (!okfLabels.includes(l)) add("P1", "okf-label-dropped", `OKF step ${s.index + 1} dropped label ${l} (has [${okfLabels.join(" ")}])`);
    }
    // Fabrication guard: a claimless step must not gain a claimed_system in OKF.
    if (!s.claimed && fm.claimed_system) {
      add("P1", "okf-fabricated-claim", `OKF step ${s.index + 1} has claimed_system="${fm.claimed_system}" but the step has no claim`);
    }
  });

  // ---- G5/G6/G7: PAM carries evidence_status; does not launder; DO_NOT_SEND + approval survive ----
  if (pam.manifest.safe_to_continue !== handoff.safe_to_continue) {
    add("P1", "pam-safe-mismatch", `PAM manifest safe_to_continue=${pam.manifest.safe_to_continue} != handoff ${handoff.safe_to_continue}`);
  }
  for (const m of pam.memories) {
    if (!m.evidence_status || typeof m.evidence_status !== "string") {
      add("P1", "pam-no-evidence-status", `PAM memory ${m.id} has no evidence_status`);
    }
  }
  const byId = new Map(pam.memories.map((m) => [m.id, m]));
  handoff.steps.forEach((s) => {
    const n = s.index + 1;
    const labels = labelsOf(s);
    const ep = byId.get(`episodic:step-${n}`);
    if (!ep) {
      add("P2", "pam-step-missing", `PAM missing episodic memory for step ${n}`);
    } else {
      // A step the witness could not confirm must never read as supported memory.
      if (hasAny(labels, EVIDENCE_GAP_LABELS) && ep.supported === true) {
        add("P1", "pam-laundered-support", `PAM episodic step ${n} supported=true but step is [${labels.join(" ")}]`);
      }
      // Fabrication guard: claimless step's episodic must not carry a claimed view.
      if (!s.claimed && ep.claimed) {
        add("P1", "pam-fabricated-claim", `PAM episodic step ${n} has a claimed view but the step has no claim`);
      }
    }
    // DO_NOT_SEND must produce a procedural do-not-send rule.
    if (labels.includes("DO_NOT_SEND") && !byId.get(`procedural:do-not-send-step-${n}`)) {
      add("P1", "pam-do-not-send-dropped", `PAM has no procedural do-not-send rule for DO_NOT_SEND step ${n}`);
    }
    // NEEDS_HUMAN_APPROVAL must produce a procedural approval rule (approval stays approval).
    if (labels.includes("NEEDS_HUMAN_APPROVAL") && !byId.get(`procedural:needs-approval-step-${n}`)) {
      add("P1", "pam-approval-dropped", `PAM has no procedural approval rule for NEEDS_HUMAN_APPROVAL step ${n}`);
    }
    // Evidence-gap semantic fact must not assert the claim happened, and must not fabricate a claim.
    const gap = byId.get(`semantic:step-${n}-evidence-gap`);
    if (hasAny(labels, EVIDENCE_GAP_LABELS) && gap) {
      if (gap.supported === true) add("P1", "pam-gap-supported", `PAM semantic evidence-gap step ${n} marked supported=true`);
      if (!s.claimed && /the agent claimed/i.test(gap.content)) {
        add("P1", "pam-gap-fabricated", `PAM semantic evidence-gap step ${n} narrates "the agent claimed" with no claim`);
      }
    }
  });

  // ---- G8: determinism (render twice, compare the bytes that ship) ----
  const second = renderAll(witnessInput);
  const a = JSON.stringify(rendered.handoff);
  const b = JSON.stringify(second.handoff);
  if (a !== b) add("P1", "nondeterministic-handoff", "handoff.json differs across two renders of the same input");
  for (const [path, content] of Object.entries(rendered.okf)) {
    if (second.okf[path] !== content) add("P1", "nondeterministic-okf", `OKF ${path} differs across renders`);
  }
  if (second.pam.files["memories.jsonl"] !== rendered.pam.files["memories.jsonl"]) {
    add("P1", "nondeterministic-pam", "PAM memories.jsonl differs across renders");
  }

  const actual = {
    safe_to_continue: handoff.safe_to_continue,
    summary: handoff.summary,
    step_labels: handoff.steps.map((s) => ({ index: s.index + 1, labels: labelsOf(s), claimed: s.claimed?.system ?? null, witnessed: s.witnessed?.system ?? null }))
  };
  return { findings, actual };
}
