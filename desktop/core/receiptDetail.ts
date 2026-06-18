// Lyhna Desktop — receipt detail view model (pure, zero-dep, testable).
//
// Builds the screen model for one capsule from the files the engine already wrote: the readable receipt
// (HANDOFF.md, shown verbatim as the main surface), the capsule manifest (capsule.json), and the machine
// receipt (handoff.json, for the per-step claimed-vs-witnessed cues). It RENDERS the engine's own fields
// (labels, human_note, verdict) — it never re-judges, re-labels, or invents anything. Same honesty
// ceiling as the receipt: claimed vs. witnessed, what's missing, what needs review.

import { verdict, countsLine, agentLabels, type VerdictTone, type InboxSummary, type InboxAgent } from "./inboxView.js";

// ---- Minimal shapes of the engine files we read (mirrors of capsule.json / handoff.json) ----

interface CapsuleArtifact {
  path?: string;
  role?: string;
  audience?: string;
  trust_boundary?: string;
  description?: string;
}

interface CapsuleManifest {
  schema?: string;
  name?: string;
  objective?: string;
  verdict?: { safe_to_continue?: boolean; summary?: Partial<InboxSummary> };
  parent_loop_id?: string;
  receipt_id?: string;
  agents?: InboxAgent[];
  artifacts?: CapsuleArtifact[];
}

interface HandoffCall {
  system?: string;
  app?: string;
  action?: string;
  result?: string;
  returned?: boolean;
}

interface HandoffStep {
  index?: number;
  claimed?: HandoffCall | null;
  witnessed?: HandoffCall | null;
  labels?: string[];
  human_note?: string;
}

interface Handoff {
  objective?: string;
  steps?: HandoffStep[];
  summary?: Partial<InboxSummary>;
  safe_to_continue?: boolean;
  parent_loop_id?: string;
  receipt_id?: string;
  agents?: InboxAgent[];
}

// ---- Screen model ----

export interface DetailArtifact {
  path: string;
  role: string | null;
  trustBoundary: string | null;
  present: boolean;
}

export interface DetailStep {
  index: number;
  claimedText: string;
  witnessedText: string;
  labels: string[];
  note: string | null;
}

export interface ReceiptDetail {
  title: string;
  objective: string | null;
  verdictLabel: string;
  verdictTone: VerdictTone;
  summaryLine: string | null;
  agentLabels: string[];
  receiptId: string | null;
  parentLoopId: string | null;
  handoffMarkdown: string | null;
  artifacts: DetailArtifact[];
  steps: DetailStep[];
  warnings: string[];
  hasCapsule: boolean;
  hasHandoff: boolean;
}

export interface ReceiptFiles {
  /** Absolute folder path (for the title fallback). */
  folder: string;
  handoffMarkdown: string | null;
  capsuleJson: string | null;
  handoffJson: string | null;
  /** Names of files/dirs present in the folder (for artifact present/missing). */
  presentNames: string[];
}

const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function baseName(p: string): string {
  const parts = p.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : p;
}

function tolerantParse<T>(text: string | null): T | null {
  if (text === null) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}

const emptySummary = (): InboxSummary => ({
  total_steps: null,
  supported: null,
  mismatches: null,
  unsupported: null,
  do_not_send: null
});

function coerceSummary(s: Partial<InboxSummary> | undefined): InboxSummary {
  const base = emptySummary();
  if (!s) return base;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    total_steps: num(s.total_steps),
    supported: num(s.supported),
    mismatches: num(s.mismatches),
    unsupported: num(s.unsupported),
    do_not_send: num(s.do_not_send)
  };
}

// The call route, preserving wrapper routing: a call witnessed through a wrapper carries both the wrapper
// (system, e.g. "zapier") and the upstream it hit (app, e.g. "google_docs"), which is exactly what a
// claimed-vs-witnessed mismatch hinges on — so render "zapier→google_docs.create_document", not just
// "zapier.create_document".
function routeText(c: HandoffCall): string {
  const route = [c.system, c.app].filter(Boolean).join("→");
  return [route, c.action].filter(Boolean).join(".");
}

function stepClaimedText(step: HandoffStep): string {
  const c = step.claimed;
  if (!c) return "(no claim)";
  const head = routeText(c) || "(claim)";
  return c.result ? `${head} — ${c.result}` : head;
}

// Surface the engine's own witnessed fields verbatim: the route, whether the call returned (returned ===
// false is a refused/escalated/error call, not a silent success), and the recorded result. No re-judging.
function stepWitnessedText(step: HandoffStep): string {
  const w = step.witnessed;
  if (!w) return "no witnessed call";
  const bits: string[] = [routeText(w) || "(witnessed call)"];
  if (w.returned === true) bits.push("returned");
  else if (w.returned === false) bits.push("did not return");
  if (w.result) bits.push(w.result);
  return bits.length > 1 ? `${bits[0]} · ${bits.slice(1).join(" · ")}` : bits[0];
}

/**
 * Build the receipt detail screen model from the engine's files. Tolerant: any file may be absent or
 * malformed; the result records that via warnings and the hasCapsule/hasHandoff flags rather than throwing.
 */
export function buildReceiptDetail(files: ReceiptFiles): ReceiptDetail {
  const capsule = tolerantParse<CapsuleManifest>(files.capsuleJson);
  const handoff = tolerantParse<Handoff>(files.handoffJson);
  const present = new Set(files.presentNames);
  const warnings: string[] = [];

  if (files.capsuleJson !== null && capsule === null) {
    warnings.push("capsule.json is present but could not be parsed.");
  }
  if (files.handoffJson !== null && handoff === null) {
    warnings.push("handoff.json is present but could not be parsed.");
  }
  if (capsule === null) {
    warnings.push("No capsule manifest — showing a degraded view; this may not be a full capsule.");
  }
  if (handoff === null) {
    warnings.push("No machine receipt (handoff.json) — per-step claimed-vs-witnessed detail isn't available.");
  }

  const safe =
    typeof capsule?.verdict?.safe_to_continue === "boolean"
      ? capsule.verdict.safe_to_continue
      : typeof handoff?.safe_to_continue === "boolean"
        ? handoff.safe_to_continue
        : null;
  const v = verdict(safe);

  const summary = coerceSummary(capsule?.verdict?.summary ?? handoff?.summary);

  // Coerce each declared artifact defensively, like the steps above: a malformed entry (e.g.
  // `artifacts: [null]`) must be skipped, not crash the detail view.
  const rawArtifacts: unknown[] = Array.isArray(capsule?.artifacts) ? (capsule.artifacts as unknown[]) : [];
  const artifacts: DetailArtifact[] = [];
  for (const raw of rawArtifacts) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const a = raw as CapsuleArtifact;
    const path = strOrNull(a.path);
    if (!path) continue;
    artifacts.push({
      path,
      role: strOrNull(a.role),
      trustBoundary: strOrNull(a.trust_boundary),
      present: present.has(path.replace(/\/+$/, ""))
    });
  }
  for (const a of artifacts) {
    if (!a.present) warnings.push(`Declared artifact missing on disk: ${a.path}`);
  }

  // Coerce each step defensively: a parseable-but-malformed receipt (e.g. a partially written
  // handoff.json with `steps: [null]`) must degrade to a warning, never crash the detail view.
  const rawSteps: unknown[] = Array.isArray(handoff?.steps) ? (handoff.steps as unknown[]) : [];
  const steps: DetailStep[] = [];
  let droppedSteps = 0;
  rawSteps.forEach((raw, i) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      droppedSteps++;
      return;
    }
    const s = raw as HandoffStep;
    steps.push({
      index: typeof s.index === "number" ? s.index : i,
      claimedText: stepClaimedText(s),
      witnessedText: stepWitnessedText(s),
      labels: Array.isArray(s.labels) ? s.labels.filter((l): l is string => typeof l === "string") : [],
      note: strOrNull(s.human_note)
    });
  });
  if (droppedSteps > 0) {
    warnings.push(`${droppedSteps} step${droppedSteps === 1 ? "" : "s"} in handoff.json could not be read and were skipped.`);
  }

  return {
    title: strOrNull(capsule?.name) ?? baseName(files.folder),
    objective: strOrNull(capsule?.objective) ?? strOrNull(handoff?.objective),
    verdictLabel: v.label,
    verdictTone: v.tone,
    summaryLine: countsLine(summary),
    agentLabels: agentLabels(capsule?.agents ?? handoff?.agents ?? null),
    receiptId: strOrNull(capsule?.receipt_id) ?? strOrNull(handoff?.receipt_id),
    parentLoopId: strOrNull(capsule?.parent_loop_id) ?? strOrNull(handoff?.parent_loop_id),
    handoffMarkdown: files.handoffMarkdown,
    artifacts,
    steps,
    warnings,
    hasCapsule: capsule !== null,
    hasHandoff: handoff !== null
  };
}
