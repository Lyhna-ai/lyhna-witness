// Lyhna Witness — PAM export (additive memory projection of a witnessed handoff).
//
// PAM (Portable Agent Memory) is a CARRIER: a format that makes agent memory portable between systems.
// Lyhna is the WITNESS: it observes the tool-call path, compares what crossed the boundary against what
// the agent claimed, and computes deterministic trust labels. This module projects a finished
// witnessed-handoff/v1 object into a PAM-shaped memory bundle so the receipt can travel as portable
// memory — WITHOUT becoming the source of truth, and WITHOUT shedding its evidence boundary.
//
// The point of carriers-vs-witness: a carrier proves transport integrity (a bundle was not altered).
// It cannot prove origin integrity (that the contents reflect anything that happened). So every memory
// item this projector emits carries its evidence verdict (`evidence_status` + `labels`). A downstream
// memory system therefore INHERITS Lyhna's honesty ceiling instead of stripping it — an unsupported
// claim stays unsupported memory; it is never upgraded into a fact. The source of truth remains the
// witnessed event sequence, the deterministic labels, handoff.json, and the proof spine.
//
// Conformance: this is Lyhna's PAM-shaped projection (`lyhna-pam/v0`), not yet validated against a
// formal published PAM schema. Wording stays "PAM-shaped / PAM memory projection" until that match is
// earned.
//
// Deterministic by contract: no clock, no randomness, no model calls. A `timestamp` appears (in the
// manifest only) solely when the caller passes one in `options` — it is never generated from the clock.

/** The five PAM memory classes Lyhna projects into. */
export const PAM_MEMORY_TYPES = Object.freeze({
  EPISODIC: "episodic",
  SEMANTIC: "semantic",
  PROCEDURAL: "procedural",
  WORKING: "working",
  IDENTITY: "identity"
});

/** The projection schema id + version (Lyhna's PAM-shaped projection, not a formal PAM schema match). */
export const PAM_PROJECTION_SCHEMA = "lyhna-pam/v0";

const SOURCE = "lyhna-witness";

// Priority order for collapsing a step's label set into one primary evidence_status. Strongest /
// most-actionable wins, so an UNSUPPORTED+DO_NOT_SEND step never reads as merely NEEDS_EVIDENCE.
const EVIDENCE_PRIORITY = [
  "DO_NOT_SEND",
  "UNSUPPORTED",
  "CLAIMED_ACTUAL_MISMATCH",
  "NEEDS_HUMAN_APPROVAL",
  "NEEDS_EVIDENCE",
  "REOPENED",
  "SUPPORTED",
  "SETTLED",
  "SAFE_TO_CONTINUE",
  "DO_NOT_RE_LITIGATE"
];

const primaryEvidence = (labels) => {
  for (const l of EVIDENCE_PRIORITY) if (labels.includes(l)) return l;
  return labels[0] ?? "UNLABELED";
};

const isSupported = (s) => (s.labels ?? []).includes("SUPPORTED") && !(s.labels ?? []).includes("UNSUPPORTED");
const isFlagged = (s) => {
  const l = s.labels ?? [];
  return (
    l.includes("UNSUPPORTED") ||
    l.includes("DO_NOT_SEND") ||
    l.includes("CLAIMED_ACTUAL_MISMATCH") ||
    l.includes("NEEDS_HUMAN_APPROVAL")
  );
};

const claimPhrase = (c) => (c ? `${c.action ?? "a step"}${c.system ? ` in ${c.system}` : ""}` : "an unspecified step");

// Project the agent's CLAIM verbatim — namespaced under `claimed` so a consumer can never mistake it
// for witnessed fact (the item's `evidence_status` governs whether it is supported).
function claimView(claimed) {
  if (!claimed) return null;
  const out = { system: claimed.system };
  if (claimed.action !== undefined) out.action = claimed.action;
  if (claimed.result !== undefined) out.result = claimed.result; // the agent's claimed result, NOT a fact
  if (claimed.user_facing !== undefined) out.user_facing = claimed.user_facing;
  return out;
}

// Project ONLY what the witness actually recorded — never invents a result.
function witnessView(witnessed) {
  if (!witnessed) return null;
  const out = { system: witnessed.system };
  if (witnessed.app !== undefined) out.app = witnessed.app;
  if (witnessed.action !== undefined) out.action = witnessed.action;
  if (witnessed.wrapper_family !== undefined) out.wrapper_family = witnessed.wrapper_family;
  if (witnessed.returned !== undefined) out.returned = witnessed.returned;
  if (witnessed.result !== undefined) out.result = witnessed.result;
  if (witnessed.result_hash !== undefined) out.result_hash = witnessed.result_hash;
  if (witnessed.error_hash !== undefined) out.error_hash = witnessed.error_hash;
  return out;
}

const hasProofRefs = (p) => p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length > 0;

/**
 * Project a witnessed-handoff/v1 object into a PAM-shaped memory bundle.
 * @param {object} handoff  the object returned by buildWitnessedHandoff.
 * @param {object} [options]
 * @param {string} [options.name]              bundle name (recorded in the manifest). Default "handoff".
 * @param {string} [options.handoffResource]   reference to the source receipt. Default "../handoff.json".
 * @param {string} [options.timestamp]         ISO timestamp; recorded in the manifest ONLY if provided.
 * @param {Array<{key:string,value:string,scope?:string}>|object} [options.identity]
 *        EXPLICIT user/org/client preferences only. Omitted ⇒ a clearly-absent identity section;
 *        preferences are never inferred from witnessed work.
 * @returns {Record<string,string>} a map of bundle-relative file path → file contents.
 */
export function renderPamBundle(handoff, options = {}) {
  const name = options.name ?? "handoff";
  const ts = options.timestamp; // manifest only; never generated
  const handoffResource = options.handoffResource ?? "../handoff.json";
  const schema = handoff.schema;
  const steps = handoff.steps ?? [];
  const summary = handoff.summary ?? {};
  const safe = Boolean(handoff.safe_to_continue);
  const proofRefs = hasProofRefs(handoff.proof_refs) ? handoff.proof_refs : undefined;

  // Run-level evidence_status: SAFE_TO_CONTINUE when safe, else the worst label present across steps.
  const allLabels = [...new Set(steps.flatMap((s) => s.labels ?? []))];
  const runEvidence = safe ? "SAFE_TO_CONTINUE" : primaryEvidence(allLabels);

  // Common envelope on EVERY memory item: where it came from, what schema, and the receipt it belongs to.
  const base = (extra) => ({
    source: SOURCE,
    lyhna_schema: schema,
    handoff_resource: handoffResource,
    ...extra
  });

  const memories = [];

  // ---- WORKING memory: current objective + continuation state + open/settled ----
  memories.push(
    base({
      id: "working:objective",
      memory_type: PAM_MEMORY_TYPES.WORKING,
      evidence_status: "CONTINUATION",
      content: `Current objective: ${handoff.objective || "(none stated)"}`,
      objective: handoff.objective || ""
    })
  );
  memories.push(
    base({
      id: "working:continuation-state",
      memory_type: PAM_MEMORY_TYPES.WORKING,
      evidence_status: runEvidence,
      safe_to_continue: safe,
      content: safe
        ? "Lyhna witnessed this run as safe to continue."
        : "Lyhna did NOT witness this run as safe to continue — it has unsupported, mismatched, or approval-gated steps. Resolve them before relying on it.",
      summary: {
        total_steps: summary.total_steps ?? 0,
        supported: summary.supported ?? 0,
        mismatches: summary.mismatches ?? 0,
        unsupported: summary.unsupported ?? 0,
        do_not_send: summary.do_not_send ?? 0
      }
    })
  );
  if ((handoff.open_questions ?? []).length) {
    memories.push(
      base({
        id: "working:open-questions",
        memory_type: PAM_MEMORY_TYPES.WORKING,
        evidence_status: "CONTINUATION",
        content: "Open questions carried forward from this run.",
        open_questions: [...handoff.open_questions]
      })
    );
  }
  if ((handoff.settled ?? []).length) {
    memories.push(
      base({
        id: "working:settled",
        memory_type: PAM_MEMORY_TYPES.WORKING,
        evidence_status: "SETTLED",
        content: "Decisions treated as settled for this run.",
        settled: [...handoff.settled]
      })
    );
  }

  // ---- EPISODIC memory: one per witnessed run step (claim + witnessed call + result + labels) ----
  for (const s of steps) {
    const labels = s.labels ?? [];
    memories.push(
      base({
        id: `episodic:step-${s.index + 1}`,
        memory_type: PAM_MEMORY_TYPES.EPISODIC,
        step_index: s.index + 1,
        evidence_status: primaryEvidence(labels),
        labels,
        supported: isSupported(s),
        content: s.human_note ?? "",
        claimed: claimView(s.claimed ?? null), // the agent's account — not fact
        witnessed: witnessView(s.witnessed ?? null) // what the witness actually saw
        // NOTE: proof_refs are deliberately NOT attached to per-step memories. The receipt's
        // proof_refs are run-level (not bound to a specific step), so attaching them to an item would
        // let an importer read a supported step's hash/URL as evidence for an unsupported claim. They
        // live on the manifest only, where they cannot be mistaken for per-step evidence.
      })
    );
  }

  // ---- SEMANTIC memory: evidence-bound facts the receipt supports ----
  memories.push(
    base({
      id: "semantic:safe-to-continue",
      memory_type: PAM_MEMORY_TYPES.SEMANTIC,
      evidence_status: runEvidence,
      safe_to_continue: safe,
      content: safe
        ? "Fact: Lyhna witnessed this run as safe to continue."
        : "Fact: this run is NOT safe to continue per Lyhna — at least one step lacks witnessed support or needs approval." // claim-neutral: a gap may be an unclaimed observed failure
    })
  );
  memories.push(
    base({
      id: "semantic:systems-touched",
      memory_type: PAM_MEMORY_TYPES.SEMANTIC,
      evidence_status: "SUPPORTED", // systems_touched is derived from what the witness observed
      content: `Fact: the witness observed these systems touched: ${(handoff.systems_touched ?? []).join(", ") || "(none)"}.`,
      systems_touched: [...(handoff.systems_touched ?? [])]
    })
  );
  // One evidence-gap fact per FLAGGED step — the honesty-preserving core: the unsupported claim becomes
  // a fact about ABSENCE of evidence, never a fact asserting the claim happened.
  for (const s of steps.filter(isFlagged)) {
    const labels = s.labels ?? [];
    memories.push(
      base({
        id: `semantic:step-${s.index + 1}-evidence-gap`,
        memory_type: PAM_MEMORY_TYPES.SEMANTIC,
        step_index: s.index + 1,
        evidence_status: primaryEvidence(labels),
        labels,
        supported: false,
        // Never invent a claim: a flagged step may be an OBSERVED failure with no agent claim
        // (claimed:null). Only say "the agent claimed …" when there actually is one.
        content: s.claimed
          ? `Fact: the agent claimed ${claimPhrase(s.claimed)}, but ${s.human_note ?? "the witness could not confirm it."}`
          : `Fact (observed, no agent claim): ${s.human_note ?? "a witnessed tool call did not succeed; recorded as an observed failure, not supported work."}`
      })
    );
  }

  // ---- PROCEDURAL memory: continuation rules (next actions, do-not-send, do-not-re-litigate) ----
  if (!safe && steps.some((s) => (s.labels ?? []).includes("UNSUPPORTED") || (s.labels ?? []).includes("DO_NOT_SEND"))) {
    memories.push(
      base({
        id: "procedural:do-not-claim-done",
        memory_type: PAM_MEMORY_TYPES.PROCEDURAL,
        evidence_status: "GUIDANCE",
        content:
          "Rule: do not tell the client (or anyone) the work is done until every unsupported step is confirmed by a witnessed tool call. Agent confidence is not evidence."
      })
    );
  }
  for (const s of steps.filter((x) => (x.labels ?? []).includes("DO_NOT_SEND"))) {
    memories.push(
      base({
        id: `procedural:do-not-send-step-${s.index + 1}`,
        memory_type: PAM_MEMORY_TYPES.PROCEDURAL,
        step_index: s.index + 1,
        evidence_status: "DO_NOT_SEND",
        labels: s.labels ?? [],
        content: s.claimed
          ? `Rule: do not send or act outward on step ${s.index + 1} (claimed ${claimPhrase(s.claimed)}) until a witnessed tool call confirms it.`
          : `Rule: do not send or act outward on step ${s.index + 1} until a witnessed tool call confirms it.`
      })
    );
  }
  (handoff.next_actions ?? []).forEach((action, i) => {
    memories.push(
      base({
        id: `procedural:next-action-${i + 1}`,
        memory_type: PAM_MEMORY_TYPES.PROCEDURAL,
        evidence_status: "GUIDANCE",
        content: action
      })
    );
  });
  (handoff.do_not_re_litigate ?? []).forEach((item, i) => {
    memories.push(
      base({
        id: `procedural:do-not-re-litigate-${i + 1}`,
        memory_type: PAM_MEMORY_TYPES.PROCEDURAL,
        evidence_status: "DO_NOT_RE_LITIGATE",
        content: `Settled — do not reopen without new evidence: ${item}`
      })
    );
  });

  // ---- IDENTITY memory: explicit preferences only; never inferred ----
  const identityItems = normalizeIdentity(options.identity);
  if (identityItems.length === 0) {
    memories.push(
      base({
        id: "identity:none",
        memory_type: PAM_MEMORY_TYPES.IDENTITY,
        evidence_status: "ABSENT",
        present: false,
        content: "No user/org/client preferences were supplied to this export. Lyhna does not infer identity from witnessed work."
      })
    );
  } else {
    identityItems.forEach((pref, i) => {
      memories.push(
        base({
          id: `identity:${pref.key ? slug(pref.key) : `pref-${i + 1}`}`,
          memory_type: PAM_MEMORY_TYPES.IDENTITY,
          evidence_status: "SUPPLIED",
          present: true,
          content: `Supplied preference${pref.scope ? ` (${pref.scope})` : ""}: ${pref.key} = ${pref.value}`,
          key: pref.key,
          value: pref.value,
          ...(pref.scope ? { scope: pref.scope } : {})
        })
      );
    });
  }

  // ---- counts + manifest ----
  const counts = { episodic: 0, semantic: 0, procedural: 0, working: 0, identity: 0 };
  for (const m of memories) counts[m.memory_type] += 1;

  const manifest = {
    schema: PAM_PROJECTION_SCHEMA,
    pam_projection: "v0",
    conformance:
      "PAM-shaped projection of a Lyhna witnessed-handoff/v1 receipt. Not yet validated against a formal published PAM schema.",
    source: SOURCE,
    lyhna_schema: schema,
    name,
    objective: handoff.objective || "",
    safe_to_continue: safe,
    summary: {
      total_steps: summary.total_steps ?? 0,
      supported: summary.supported ?? 0,
      mismatches: summary.mismatches ?? 0,
      unsupported: summary.unsupported ?? 0,
      do_not_send: summary.do_not_send ?? 0
    },
    memory_types: Object.values(PAM_MEMORY_TYPES),
    memory_counts: counts,
    memory_total: memories.length,
    memories_file: "memories.jsonl",
    handoff_resource: handoffResource,
    ...(proofRefs ? { proof_refs: proofRefs } : {}),
    ...(ts ? { timestamp: ts } : {}),
    honesty_ceiling: {
      witnessed: "action-level only — what crossed the tool boundary vs. what the agent claimed",
      never_asserts: [
        "that a claimed-but-unwitnessed action happened (e.g. an email was sent)",
        "business / legal / quality correctness of the work",
        "client or third-party behavior",
        "anything outside the observed workflow",
        "agent confidence as evidence"
      ],
      rule: "every memory item carries evidence_status; an unsupported claim stays unsupported and is never upgraded into a fact"
    }
  };

  return {
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
    "memories.jsonl": memories.map((m) => JSON.stringify(m)).join("\n") + "\n",
    "README.md": readme(name, handoff, counts)
  };
}

function readme(name, handoff, counts) {
  const safe = Boolean(handoff.safe_to_continue);
  return [
    `# PAM memory projection — ${name}`,
    ``,
    `This directory is a **PAM-shaped memory projection** of a Lyhna witnessed handoff. **PAM is the`,
    `memory container; Lyhna is the witness.** Lyhna observed the tool-call path, compared what crossed`,
    `the boundary to what the agent claimed, and labeled each step. This bundle lets a downstream agent`,
    `ingest that receipt as portable memory **without losing the evidence boundary** — every item in`,
    `\`memories.jsonl\` carries an \`evidence_status\`, so an unsupported claim stays unsupported memory and`,
    `is never upgraded into a fact.`,
    ``,
    `- \`manifest.json\` — bundle metadata, summary, memory-type counts, and the honesty ceiling.`,
    `- \`memories.jsonl\` — one memory item per line, across PAM's five classes:`,
    `  episodic (${counts.episodic}), semantic (${counts.semantic}), procedural (${counts.procedural}),`,
    `  working (${counts.working}), identity (${counts.identity}).`,
    ``,
    `**Verdict:** ${safe ? "✅ safe to continue" : "⛔ NOT safe to continue / send yet"}.`,
    ``,
    `The source of truth remains the witnessed event sequence, the deterministic labels, \`handoff.json\`,`,
    `and the proof spine. This is an additive, read-only export beside them. Conformance: \`lyhna-pam/v0\``,
    `— a PAM-shaped projection, not yet validated against a formal published PAM schema.`,
    ``
  ].join("\n");
}

// --- identity helpers: accept an array of {key,value,scope?} or a flat object; never infer ---
function normalizeIdentity(identity) {
  if (!identity) return [];
  if (Array.isArray(identity)) {
    return identity
      .filter((p) => p && p.key !== undefined && p.value !== undefined)
      .map((p) => ({ key: String(p.key), value: String(p.value), ...(p.scope ? { scope: String(p.scope) } : {}) }));
  }
  if (typeof identity === "object") {
    return Object.entries(identity)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([key, value]) => ({ key, value: String(value) }));
  }
  return [];
}

const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pref";
