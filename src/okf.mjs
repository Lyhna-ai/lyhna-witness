// Lyhna Witness — OKF export (additive projection of a witnessed handoff).
//
// OKF (Open Knowledge Format, v0.1) is a portable directory of markdown files with YAML frontmatter.
// It is a CONTAINER, not a trust system. Lyhna remains the witness: it observes the tool-call path,
// compares what crossed the boundary against what the agent claimed, and computes deterministic trust
// labels. This module projects a finished witnessed-handoff/v1 object into an OKF-compatible bundle so
// the same testimony can travel into repos, catalogs, and knowledge systems — WITHOUT becoming the
// source of truth. The source of truth stays the witnessed event sequence, the deterministic labels,
// handoff.json, and the proof spine. OKF is a read-only export beside them.
//
// Deterministic by contract: no clock, no randomness, no model calls. `timestamp` appears in
// frontmatter only when the caller passes one in `options` — it is never generated from the wall clock.

/** The Lyhna concept `type`s emitted into OKF frontmatter (the agent-usable product surface). */
export const OKF_LYHNA_TYPES = Object.freeze({
  HANDOFF: "Lyhna Witnessed Handoff",
  STEP: "Lyhna Witnessed Step",
  LABEL: "Lyhna Trust Label",
  PROMPT: "Lyhna Safe Continuation Prompt",
  INDEX: "Lyhna Witnessed Handoff Bundle",
  LOG: "Lyhna Witnessed Handoff Log"
});

// Plain-language meaning of each trust label, so a `labels/<LABEL>.md` concept is self-describing.
const LABEL_DESCRIPTIONS = Object.freeze({
  SUPPORTED: "The agent's account matches what the tool-call witness observed.",
  UNSUPPORTED: "A claimed or observed step the witness could not confirm as successful — no supporting tool evidence, or the call did not return.",
  NEEDS_EVIDENCE: "Not yet backed by an observed tool call; evidence is required before relying on it.",
  NEEDS_HUMAN_APPROVAL: "Escalated — a human must approve this step before anyone proceeds.",
  CLAIMED_ACTUAL_MISMATCH: "What the agent claimed differs from what the witness observed (a different route, action, or result).",
  SETTLED: "Treated as settled; do not re-litigate without new evidence.",
  REOPENED: "A previously settled decision that has been reopened.",
  SAFE_TO_CONTINUE: "The run is safe for the next human or AI to continue from.",
  DO_NOT_SEND: "Do not send or act on this outward — a user-facing step with no supporting evidence.",
  DO_NOT_RE_LITIGATE: "Do not reopen or re-argue this; it is settled."
});

const yamlScalar = (v) =>
  typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(String(v));

/**
 * Render an ordered list of [key, value] pairs as a parseable YAML frontmatter block. Values may be
 * scalars, arrays (block list), or flat objects (indented map). null/undefined pairs are skipped.
 */
function frontmatter(pairs) {
  const lines = ["---"];
  for (const [key, value] of pairs) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${key}: []`);
      else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${yamlScalar(item)}`);
      }
    } else if (typeof value === "object") {
      const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null);
      if (entries.length === 0) lines.push(`${key}: {}`);
      else {
        lines.push(`${key}:`);
        for (const [k, v] of entries) lines.push(`  ${k}: ${yamlScalar(v)}`);
      }
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

const proofRefPairs = (proofRefs) =>
  proofRefs && typeof proofRefs === "object" && !Array.isArray(proofRefs)
    ? Object.entries(proofRefs).filter(([, v]) => v !== undefined && v !== null && v !== "")
    : [];

const stepSlug = (index) => `step-${String(index + 1).padStart(3, "0")}`;
const distinctStepLabels = (handoff) =>
  [...new Set((handoff.steps ?? []).flatMap((s) => s.labels ?? []))].sort();

const claimPhrase = (c) => (c ? `${c.action ?? "step"}${c.system ? ` in ${c.system}` : ""}` : "(no claim)");

// The OKF handoff concept's agent-attribution section. Emitted only when the run carries an agents
// summary, so a plain run's bundle is byte-identical. Attribution is from captured evidence only.
function okfAgentsSection(handoff) {
  if (!handoff.agents?.length) return [];
  const rows = handoff.agents.map((a) => {
    const label = a.subagent_role ? `${a.subagent_role} agent` : a.agent_id;
    const flag = a.all_supported
      ? "attributed steps supported"
      : `not all supported — branch status: ${(a.nonsupported_statuses ?? []).join(", ") || "unknown"}`;
    return `- **${label}** (\`${a.agent_id}\`) — step${a.steps.length === 1 ? "" : "s"} ${a.steps.join(", ")} — ${flag}`;
  });
  return [
    `## Agents`,
    `_Attributed from captured evidence only — an agent whose tool path was not routed through Lyhna does not appear._`,
    ...rows,
    ``
  ];
}
const witnessPhrase = (w) =>
  w
    ? `${w.system ?? "?"}${w.app ? ` → ${w.app}` : ""}${w.action ? `.${w.action}` : ""}` +
      ` (${w.result ?? (w.returned === false ? "no result" : "ok")})`
    : "nothing observed";

/**
 * Project a witnessed-handoff/v1 object into an OKF-compatible bundle.
 * @param {object} handoff  the object returned by buildWitnessedHandoff
 * @param {object} [options]
 * @param {string} [options.name]        bundle/handoff slug (filename under handoffs/). Default "handoff".
 * @param {string} [options.title]       human title for the handoff concept.
 * @param {string} [options.description] human description for the handoff concept.
 * @param {string[]} [options.tags]      extra tags merged into the base tags.
 * @param {string} [options.timestamp]   ISO timestamp; included in frontmatter ONLY if provided (never generated).
 * @returns {Record<string,string>} a map of bundle-relative file path → file contents.
 */
export function renderOkfBundle(handoff, options = {}) {
  const name = options.name ?? "handoff";
  const ts = options.timestamp; // included only when present; never generated
  const summary = handoff.summary ?? {};
  const labels = distinctStepLabels(handoff);
  const baseTags = ["lyhna", "witnessed-handoff", "claimed-vs-actual", ...(options.tags ?? [])];
  const title = options.title ?? `Witnessed Handoff: ${handoff.objective || "(no objective stated)"}`;
  const description =
    options.description ??
    `What the agent actually did vs. what it claimed — ${handoff.safe_to_continue ? "safe to continue" : "NOT safe to continue"}.`;

  // Shared summary frontmatter fields reused across concept files.
  const summaryFields = [
    ["lyhna_schema", handoff.schema],
    ["safe_to_continue", Boolean(handoff.safe_to_continue)],
    ["summary_total_steps", summary.total_steps ?? 0],
    ["summary_supported", summary.supported ?? 0],
    ["summary_mismatches", summary.mismatches ?? 0],
    ["summary_unsupported", summary.unsupported ?? 0],
    ["summary_do_not_send", summary.do_not_send ?? 0]
  ];

  const files = {};
  const handoffRel = `handoffs/${name}.md`;

  // --- handoffs/<name>.md : the Lyhna Witnessed Handoff concept --------------------------------
  {
    const fm = frontmatter([
      ["type", OKF_LYHNA_TYPES.HANDOFF],
      ["title", title],
      ["description", description],
      ["tags", baseTags],
      ["timestamp", ts],
      ...summaryFields,
      ["lyhna_labels", labels],
      ["parent_loop_id", handoff.parent_loop_id],
      ["receipt_id", handoff.receipt_id],
      ["handoff_resource", `${name}.md`],
      ["proof_refs", handoff.proof_refs ?? undefined]
    ]);
    const body = [
      `# ${title}`,
      ``,
      `> Lyhna is the independent witness in the tool-call path. This is its testimony — not the agent's self-report.`,
      ``,
      `**Verdict:** ${handoff.safe_to_continue ? "✅ Safe to continue." : "⛔ NOT safe to continue / send yet."}`,
      ``,
      `**Objective:** ${handoff.objective || "_(none stated)_"}`,
      ``,
      `**Summary:** ${summary.total_steps ?? 0} steps · ${summary.supported ?? 0} supported · ` +
        `${summary.mismatches ?? 0} mismatch · ${summary.unsupported ?? 0} unsupported · ${summary.do_not_send ?? 0} do-not-send`,
      ``,
      ...okfAgentsSection(handoff),
      `## Claimed vs. Actual (by step)`,
      ...(handoff.steps ?? []).map(
        (s) =>
          `- [Step ${s.index + 1}](../steps/${stepSlug(s.index)}.md) \`${(s.labels ?? []).join(" ")}\` — ` +
          `claimed ${claimPhrase(s.claimed)}; witness saw ${witnessPhrase(s.witnessed)}`
      ),
      ``,
      `## Systems Touched`,
      (handoff.systems_touched ?? []).length ? (handoff.systems_touched ?? []).map((x) => `- ${x}`).join("\n") : "_(none)_",
      ``,
      `## Trust Labels Present`,
      labels.length ? labels.map((l) => `- [${l}](../labels/${l}.md)`).join("\n") : "_(none)_",
      ``,
      `## Safe Continuation`,
      `See [the safe-continuation prompt](../prompts/next-ai-prompt.md) for the machine-readable handoff to the next agent.`,
      ``,
      `---`,
      `_OKF is the container; Lyhna is the witness. This bundle is a portable export — the source of truth remains the witnessed event sequence, the deterministic labels, handoff.json, and the proof spine._`,
      ``
    ].join("\n");
    files[handoffRel] = `${fm}\n\n${body}`;
  }

  // --- steps/step-NNN.md : one Lyhna Witnessed Step per step -----------------------------------
  for (const s of handoff.steps ?? []) {
    const claimed = s.claimed ?? null;
    const witnessed = s.witnessed ?? null;
    const sysAction =
      `${claimed?.system ?? witnessed?.system ?? "?"}.${claimed?.action ?? witnessed?.action ?? "step"}`;
    const stepTitle = `Step ${s.index + 1} — ${sysAction}`;
    // Claim-to-action contract fields, emitted ONLY when the step carries a contract (frontmatter()
    // skips null/undefined pairs, so a plain run's step concept is byte-identical to before).
    const c = s.contract ?? null;
    const fm = frontmatter([
      ["type", OKF_LYHNA_TYPES.STEP],
      ["title", stepTitle],
      ["description", s.human_note ?? ""],
      ["tags", [...baseTags, "step"]],
      ["timestamp", ts],
      ["lyhna_schema", handoff.schema],
      ["step_index", s.index + 1],
      ["lyhna_labels", s.labels ?? []],
      ["claimed_system", claimed?.system],
      ["claimed_action", claimed?.action],
      ["witnessed_system", witnessed?.system],
      ["witnessed_action", witnessed?.action],
      ["agent_id", c?.agent_id],
      ["subagent_role", c?.subagent_role],
      ["contract_status", c?.status],
      ["link_basis", c?.link_basis],
      ["claimed_action_family", c?.claimed_action_family],
      ["observed_action_family", c?.observed_action_family],
      ["artifact_id", c?.artifact_id],
      ["handoff_resource", `../${handoffRel}`]
    ]);
    const body = [
      `# ${stepTitle}`,
      ``,
      `**Agent claimed:** ${claimPhrase(claimed)}${claimed?.result ? ` → "${claimed.result}"` : ""}`,
      ``,
      `**Witness observed:** ${witnessPhrase(witnessed)}`,
      ``,
      `**Labels:** ${(s.labels ?? []).map((l) => `[${l}](../labels/${l}.md)`).join(", ") || "_(none)_"}`,
      ``,
      ...(c ? [`**Contract:** ${c.reader_explanation}`, ``] : []),
      `**Note:** ${s.human_note ?? ""}`,
      ``,
      `Part of [${title}](../${handoffRel}).`,
      ``
    ].join("\n");
    files[`steps/${stepSlug(s.index)}.md`] = `${fm}\n\n${body}`;
  }

  // --- labels/<LABEL>.md : one Lyhna Trust Label per distinct step label -----------------------
  for (const label of labels) {
    const carriers = (handoff.steps ?? []).filter((s) => (s.labels ?? []).includes(label));
    const fm = frontmatter([
      ["type", OKF_LYHNA_TYPES.LABEL],
      ["title", label],
      ["description", LABEL_DESCRIPTIONS[label] ?? "A Lyhna trust label."],
      ["tags", [...baseTags, "trust-label"]],
      ["timestamp", ts],
      ["lyhna_schema", handoff.schema],
      ["lyhna_labels", [label]],
      ["step_count", carriers.length],
      ["handoff_resource", `../${handoffRel}`]
    ]);
    const body = [
      `# ${label}`,
      ``,
      LABEL_DESCRIPTIONS[label] ?? "A Lyhna trust label.",
      ``,
      `## Steps carrying this label`,
      carriers.length
        ? carriers.map((s) => `- [Step ${s.index + 1}](../steps/${stepSlug(s.index)}.md): ${s.human_note ?? ""}`).join("\n")
        : "_(none)_",
      ``,
      `Part of [${title}](../${handoffRel}).`,
      ``
    ].join("\n");
    files[`labels/${label}.md`] = `${fm}\n\n${body}`;
  }

  // --- prompts/next-ai-prompt.md : the Lyhna Safe Continuation Prompt --------------------------
  {
    const fm = frontmatter([
      ["type", OKF_LYHNA_TYPES.PROMPT],
      ["title", `Safe Continuation Prompt: ${name}`],
      ["description", "Machine-readable handoff for the next agent, marked safe or not-safe to continue."],
      ["tags", [...baseTags, "next-ai-prompt"]],
      ["timestamp", ts],
      ["lyhna_schema", handoff.schema],
      ["safe_to_continue", Boolean(handoff.safe_to_continue)],
      ["handoff_resource", `../${handoffRel}`]
    ]);
    // Mirror the canonical renderNextAiPrompt continuation context so an agent consuming ONLY this
    // file still gets the settled/do-not-re-litigate guardrails, open questions, and proof pointers.
    const listOr = (arr) => (arr.length ? arr : ["- _(none)_"]);
    const stepLink = (s) => `- [Step ${s.index + 1}](../steps/${stepSlug(s.index)}.md): ${s.human_note ?? ""}`;
    const settledAll = [...(handoff.settled ?? []), ...(handoff.do_not_re_litigate ?? [])];
    const unverified = (handoff.steps ?? []).filter(
      (s) => (s.labels ?? []).includes("UNSUPPORTED") || (s.labels ?? []).includes("CLAIMED_ACTUAL_MISMATCH")
    );
    const gated = (handoff.steps ?? []).filter((s) => (s.labels ?? []).includes("NEEDS_HUMAN_APPROVAL"));
    const proofEntries = proofRefPairs(handoff.proof_refs);
    const body = [
      `# Safe Continuation Prompt`,
      ``,
      `Continuation handoff for [${title}](../${handoffRel}).`,
      ``,
      `**Objective:** ${handoff.objective || "(none stated)"}`,
      ``,
      `The operator declared these settled (Lyhna did NOT witness or verify them) — do not re-litigate unless new evidence appears:`,
      ...listOr(settledAll.map((x) => `- ${x}`)),
      ``,
      `**Status:** ${handoff.safe_to_continue ? "Safe to continue." : "NOT safe to send/continue until the unverified steps and any required approvals are resolved."}`,
      ``,
      `These steps are UNVERIFIED by the tool-call witness — do not assume they happened, and do not tell anyone they are done until confirmed:`,
      ...listOr(unverified.map(stepLink)),
      ``,
      `These steps REQUIRE HUMAN APPROVAL before anyone proceeds — do not act on them yourself:`,
      ...listOr(gated.map((s) => `- [Step ${s.index + 1}](../steps/${stepSlug(s.index)}.md): ${s.human_note ?? "awaiting human approval"}`)),
      ``,
      `**Open questions:**`,
      ...listOr((handoff.open_questions ?? []).map((x) => `- ${x}`)),
      ``,
      `**Next actions:**`,
      ...listOr((handoff.next_actions ?? []).map((x) => `- ${x}`)),
      ``,
      `**Proof / references** — carry these forward so the vouched-for work stays verifiable:`,
      ...listOr(proofEntries.map(([k, v]) => `- ${k}: ${v}`)),
      ``
    ].join("\n");
    files["prompts/next-ai-prompt.md"] = `${fm}\n\n${body}`;
  }

  // --- index.md : OKF catalog / entry point ----------------------------------------------------
  {
    const fm = frontmatter([
      ["type", OKF_LYHNA_TYPES.INDEX],
      ["title", title],
      ["description", description],
      ["tags", baseTags],
      ["timestamp", ts],
      ...summaryFields,
      ["lyhna_labels", labels],
      ["handoff_resource", handoffRel],
      ["proof_refs", handoff.proof_refs ?? undefined]
    ]);
    const body = [
      `# ${title}`,
      ``,
      `An OKF-compatible export of a Lyhna witnessed handoff. OKF is the container; Lyhna is the witness.`,
      ``,
      `**Verdict:** ${handoff.safe_to_continue ? "✅ Safe to continue." : "⛔ NOT safe to continue / send yet."}`,
      ``,
      `## Contents`,
      `- [Witnessed Handoff](${handoffRel})`,
      `- [Safe Continuation Prompt](prompts/next-ai-prompt.md)`,
      `- Steps:`,
      ...(handoff.steps ?? []).map((s) => `  - [Step ${s.index + 1}](steps/${stepSlug(s.index)}.md) \`${(s.labels ?? []).join(" ")}\``),
      `- Trust labels:`,
      ...(labels.length ? labels.map((l) => `  - [${l}](labels/${l}.md)`) : ["  - _(none)_"]),
      ``,
      `See [log.md](log.md) for provenance.`,
      ``
    ].join("\n");
    files["index.md"] = `${fm}\n\n${body}`;
  }

  // --- log.md : OKF provenance log -------------------------------------------------------------
  {
    const fm = frontmatter([
      ["type", OKF_LYHNA_TYPES.LOG],
      ["title", `Log: ${title}`],
      ["description", "Provenance log for this witnessed-handoff OKF bundle."],
      ["tags", [...baseTags, "log"]],
      ["timestamp", ts]
    ]);
    const body = [
      `# Log`,
      ``,
      `- Generated OKF bundle from \`${handoff.schema}\`${ts ? ` at ${ts}` : ""}.`,
      `- Verdict: ${handoff.safe_to_continue ? "safe_to_continue=true" : "safe_to_continue=false"}.`,
      `- Steps: ${summary.total_steps ?? 0} (${summary.supported ?? 0} supported, ${summary.mismatches ?? 0} mismatch, ${summary.unsupported ?? 0} unsupported, ${summary.do_not_send ?? 0} do-not-send).`,
      `- Source of truth remains the witnessed event sequence, the deterministic labels, handoff.json, and the proof spine; this bundle is a portable projection.`,
      ``
    ].join("\n");
    files["log.md"] = `${fm}\n\n${body}`;
  }

  return files;
}
