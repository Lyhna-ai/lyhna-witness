// Lyhna Witness — capsule manifest/index (the deliverable's table of contents).
//
// A witnessed run produces a BUNDLE, not a single file: the readable receipt (HANDOFF.md), the
// machine receipt (handoff.json), the continuation prompt (next-ai-prompt.md), and — when asked —
// the OKF knowledge bundle and the PAM-shaped memory bundle. That bundle IS the product the buyer
// walks away with. This module renders the capsule's own index so the bundle explains itself: what
// each file is, who it is for, and — the honest part — WHAT TRUST BOUNDARY it carries.
//
// The manifest asserts nothing new about the work. It is a tool-generated description of the
// already-rendered handoff; it carries no witnessed claim of its own. Determinism by contract: no
// clock, no randomness, no model calls — a `timestamp` appears only when the caller passes one.

export const CAPSULE_SCHEMA = "lyhna-capsule/v1";

// The honesty ceiling, stated once at the capsule level so a reader who opens ONLY the index still
// learns what Lyhna does and does not assert. Mirrors the ceiling carried in the PAM manifest.
const HONESTY_CEILING = Object.freeze({
  witnessed: "action-level only — what crossed the tool boundary vs. what the agent claimed",
  never_asserts: [
    "that a claimed-but-unwitnessed action happened (e.g. an email was sent)",
    "business / legal / quality correctness of the work",
    "client or third-party behavior",
    "anything outside the observed workflow",
    "agent confidence as evidence"
  ]
});

// Trust-boundary vocabulary. Each artifact in the capsule sits on exactly one boundary, and the
// manifest is honest about which: a witnessed receipt is NOT the same kind of object as a portable
// carrier projection, and neither is the same as this tool-generated index.
const TRUST_BOUNDARY = Object.freeze({
  WITNESSED: "witnessed-receipt",
  CONTINUATION: "witnessed-continuation",
  CARRIER: "carrier-projection",
  INDEX: "capsule-index"
});

const BOUNDARY_MEANING = Object.freeze({
  [TRUST_BOUNDARY.WITNESSED]:
    "Claimed-vs-witnessed receipt. Action-level witnessed truth; the Settled / Do-Not-Re-Litigate sections are operator-declared, not witnessed by Lyhna.",
  [TRUST_BOUNDARY.CONTINUATION]:
    "Continuation handoff derived from the receipt. Carries the same witnessed verdicts and operator-declared context — adds no new claim.",
  [TRUST_BOUNDARY.CARRIER]:
    "Portable projection in a carrier format. A carrier proves transport (the bundle was not altered), not origin; every item still carries its Lyhna evidence label, so an unsupported claim stays unsupported.",
  [TRUST_BOUNDARY.INDEX]:
    "Tool-generated description of this bundle. Not witnessed evidence and asserts nothing about the work."
});

/**
 * The artifact descriptors that are ALWAYS in a capsule (the handoff trio + this index pair),
 * in the order a reader should meet them. OKF / PAM are appended conditionally by renderCapsule.
 */
function baseArtifacts() {
  return [
    {
      path: "CAPSULE.md",
      role: "Capsule index (start here)",
      format: "markdown",
      audience: "human",
      trust_boundary: TRUST_BOUNDARY.INDEX,
      description: "Human-readable table of contents for this capsule: what each file is and the trust boundary it carries."
    },
    {
      path: "capsule.json",
      role: "Capsule manifest",
      format: "json",
      audience: "machine",
      trust_boundary: TRUST_BOUNDARY.INDEX,
      description: "Machine-readable manifest of this capsule's artifacts, verdict, and honesty ceiling."
    },
    {
      path: "HANDOFF.md",
      role: "The AI Work Receipt (readable)",
      format: "markdown",
      audience: "human",
      trust_boundary: TRUST_BOUNDARY.WITNESSED,
      description: "What the agent claimed vs. what the witness saw cross the tool boundary, what is supported, what is unsupported or mismatched, and what is safe to continue."
    },
    {
      path: "handoff.json",
      role: "The AI Work Receipt (machine)",
      format: "json",
      audience: "machine",
      trust_boundary: TRUST_BOUNDARY.WITNESSED,
      description: "The same receipt as structured data: per-step claimed/witnessed pairs, deterministic trust labels, and the run summary."
    },
    {
      path: "next-ai-prompt.md",
      role: "Continuation prompt",
      format: "markdown",
      audience: "agent",
      trust_boundary: TRUST_BOUNDARY.CONTINUATION,
      description: "A safe-continuation handoff for the next human or AI: unverified steps to confirm, approvals required, and what not to re-litigate."
    }
  ];
}

const CARRIER_ARTIFACTS = Object.freeze({
  okf: {
    path: "okf/",
    role: "OKF knowledge bundle",
    format: "okf-directory",
    audience: "knowledge-system",
    trust_boundary: TRUST_BOUNDARY.CARRIER,
    description: "Portable Open-Knowledge-Format projection of the receipt — every step and label travels with its evidence boundary intact."
  },
  pam: {
    path: "pam/",
    role: "PAM-shaped memory bundle",
    format: "pam-shaped-directory",
    audience: "memory-system",
    trust_boundary: TRUST_BOUNDARY.CARRIER,
    description: "PAM-shaped memory projection of the receipt — every memory item carries its evidence_status, so an unsupported claim is never upgraded into a fact."
  }
});

/**
 * Render the capsule's self-describing index.
 * @param {object} handoff   the object returned by buildWitnessedHandoff.
 * @param {object} [options]
 * @param {string} [options.name]       capsule name (recorded in the manifest). Default "handoff".
 * @param {string[]} [options.exports]  which optional carrier bundles are present, e.g. ["okf","pam"].
 * @param {string} [options.timestamp]  ISO timestamp; recorded ONLY if provided (never generated).
 * @returns {Record<string,string>} a map of { "CAPSULE.md": ..., "capsule.json": ... }.
 */
export function renderCapsule(handoff, options = {}) {
  const name = options.name ?? "handoff";
  const ts = options.timestamp; // recorded only when present; never generated
  const summary = handoff.summary ?? {};
  const safe = Boolean(handoff.safe_to_continue);

  // Carrier bundles, appended in a fixed order so the manifest is deterministic regardless of the
  // order the caller listed its export flags.
  const present = new Set(options.exports ?? []);
  const artifacts = baseArtifacts();
  for (const key of ["okf", "pam"]) {
    if (present.has(key)) artifacts.push(CARRIER_ARTIFACTS[key]);
  }

  // Which trust boundaries actually appear in this capsule, so the index can define only those.
  const boundariesPresent = [...new Set(artifacts.map((a) => a.trust_boundary))];

  const manifest = {
    schema: CAPSULE_SCHEMA,
    name,
    lyhna_schema: handoff.schema,
    objective: handoff.objective || "",
    verdict: {
      safe_to_continue: safe,
      summary: {
        total_steps: summary.total_steps ?? 0,
        supported: summary.supported ?? 0,
        mismatches: summary.mismatches ?? 0,
        unsupported: summary.unsupported ?? 0,
        do_not_send: summary.do_not_send ?? 0
      }
    },
    // Claim-to-action spine, run level — only when present (plain capsules unchanged). `agents` is
    // captured evidence only: an agent not routed through Lyhna never appears.
    ...(handoff.parent_loop_id ? { parent_loop_id: handoff.parent_loop_id } : {}),
    ...(handoff.receipt_id ? { receipt_id: handoff.receipt_id } : {}),
    ...(handoff.agents?.length ? { agents: handoff.agents } : {}),
    artifacts,
    trust_boundaries: Object.fromEntries(boundariesPresent.map((b) => [b, BOUNDARY_MEANING[b]])),
    honesty_ceiling: HONESTY_CEILING,
    ...(ts ? { timestamp: ts } : {})
  };

  return {
    "CAPSULE.md": renderCapsuleMarkdown(handoff, { name, artifacts, boundariesPresent, ts }),
    "capsule.json": JSON.stringify(manifest, null, 2) + "\n"
  };
}

// The capsule index's agent line, emitted only on an agent-attributed run (plain capsules unchanged).
function capsuleAgentsSection(handoff) {
  if (!handoff.agents?.length) return [];
  const rows = handoff.agents.map((a) => {
    const label = a.subagent_role ? `${a.subagent_role} agent` : a.agent_id;
    const idPart = a.agent_id ? ` (\`${a.agent_id}\`)` : "";
    const flag = a.all_supported
      ? "all attributed steps supported"
      : `⚠ not all supported — branch status: ${(a.nonsupported_statuses ?? []).join(", ") || "unknown"}`;
    return `- **${label}**${idPart} — step${a.steps.length === 1 ? "" : "s"} ${a.steps.join(", ")} — ${flag}`;
  });
  return [
    `## Agents witnessed`,
    `_Attributed from captured evidence only — an agent whose tool path was not routed through Lyhna does not appear._`,
    ...rows,
    ``
  ];
}

// One plain-language line a non-technical buyer can act on, derived ONLY from the verdict + counts that
// are already on the page (it restates them, asserts nothing new). For a not-safe run it names how many
// claimed steps the witness could not back and what NOT to do; for a safe run it states the support and
// the ceiling (tool-level actions, not business outcomes).
function plainMeaning(handoff) {
  const s = handoff.summary ?? {};
  const total = s.total_steps ?? 0;
  if (handoff.safe_to_continue) {
    return (
      `**What this means:** every claimed step is backed by what the witness saw at the tool boundary. ` +
      `(Lyhna confirms tool-level actions, not business outcomes — use your own judgment before acting.)`
    );
  }
  const unconfirmed = Math.max(total - (s.supported ?? 0), 0);
  return (
    `**What this means:** ${unconfirmed} of ${total} claimed step${total === 1 ? "" : "s"} ` +
    `${unconfirmed === 1 ? "is" : "are"} not backed by witnessed evidence (unconfirmed or mismatched). ` +
    `Don't treat the work as done — or send anything to a client — until you've checked the flagged steps in \`HANDOFF.md\`.`
  );
}

function renderCapsuleMarkdown(handoff, { name, artifacts, boundariesPresent, ts }) {
  const summary = handoff.summary ?? {};
  const safe = Boolean(handoff.safe_to_continue);
  const verdict = safe ? "✅ Safe to continue." : "⛔ NOT safe to continue / send yet — see the receipt.";

  const artifactRows = artifacts.map(
    (a) => `| \`${a.path}\` | ${a.role} | ${a.audience} | ${a.trust_boundary} | ${a.description} |`
  );

  return [
    `# AI Work Receipt Capsule — ${name}`,
    ``,
    `> This capsule is what a single witnessed run produces. It is Lyhna's testimony — what crossed`,
    `> the tool boundary vs. what the agent claimed — not the agent's self-report. Start with the`,
    `> receipt (\`HANDOFF.md\`); this index explains every file and the trust boundary it carries.`,
    ``,
    `**Verdict:** ${verdict}`,
    ``,
    plainMeaning(handoff),
    ``,
    `**Objective:** ${handoff.objective || "_(none stated)_"}`,
    ``,
    `**Summary:** ${summary.total_steps ?? 0} steps · ${summary.supported ?? 0} supported · ` +
      `${summary.mismatches ?? 0} mismatch · ${summary.unsupported ?? 0} unsupported · ${summary.do_not_send ?? 0} do-not-send`,
    `_Counts can overlap — a step may carry more than one flag — so they need not add up to the step total._`,
    ``,
    ...capsuleAgentsSection(handoff),
    `## What's in this capsule`,
    ``,
    `**You only need \`HANDOFF.md\`** (and this index). The rest are machine-readable copies of the same receipt.`,
    ``,
    `| File | What it is | For | Trust boundary | Description |`,
    `| --- | --- | --- | --- | --- |`,
    ...artifactRows,
    ``,
    `## Trust boundaries`,
    ``,
    ...boundariesPresent.map((b) => `- **${b}** — ${BOUNDARY_MEANING[b]}`),
    ``,
    `## What this capsule does and does not assert`,
    ``,
    `Lyhna witnesses ${HONESTY_CEILING.witnessed}. It never asserts:`,
    ``,
    ...HONESTY_CEILING.never_asserts.map((x) => `- ${x}`),
    ``,
    `---`,
    `_Lyhna is the independent witness in the agent's tool-call path. This capsule is a portable export;` +
      ` the source of truth remains the witnessed event sequence, the deterministic labels, \`handoff.json\`, and the proof spine.${
        ts ? ` Generated ${ts}.` : ""
      }_`,
    ``
  ].join("\n");
}
