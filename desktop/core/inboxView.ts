// Lyhna Desktop — inbox view model (pure, framework-agnostic, zero runtime deps).
//
// This is the ONLY place the desktop turns the engine's inbox data into screen-ready rows. It mirrors the
// `lyhna-inbox/v0` JSON that `lyhna-witness`'s indexer / `inbox-cli.mjs --json` already produces and adds
// nothing of its own — same honesty ceiling as the receipt. It witnesses nothing; it just presents what
// the capsule files already said. Kept pure (no DOM, no Node, no Electron) so it unit-tests headlessly and
// so the same logic works under any shell (Electron now, Tauri later) or in tests.

// ---- Engine JSON shapes (mirror of lyhna-inbox/v0; see lyhna-witness/src/capsule-indexer.mjs) ----

export interface InboxSummary {
  total_steps: number | null;
  supported: number | null;
  mismatches: number | null;
  unsupported: number | null;
  do_not_send: number | null;
}

export interface InboxAgent {
  agent_id?: string;
  subagent_role?: string;
  steps?: number[];
  all_supported?: boolean;
  has_unsupported?: boolean;
  nonsupported_statuses?: string[];
}

export type InboxKind = "capsule" | "partial" | "unreadable";

export interface InboxEntry {
  folder: string;
  folderName: string;
  kind: InboxKind;
  name: string | null;
  objective: string | null;
  safe_to_continue: boolean | null;
  summary: InboxSummary;
  parent_loop_id: string | null;
  receipt_id: string | null;
  agents: InboxAgent[] | null;
  artifacts: string[];
  missing_files: string[];
  timestamp: string | null;
  warnings: string[];
}

export interface InboxIndex {
  schema: string;
  root: string;
  included_partial: boolean;
  count: number;
  shown: number;
  entries: InboxEntry[];
}

// ---- Screen-ready view model ----

export type VerdictTone = "ok" | "review" | "muted";

export interface InboxRow {
  /** Stable unique id for React keys — the absolute folder path. */
  id: string;
  title: string;
  folderName: string;
  kind: InboxKind;
  /** "partial" / "unreadable" for non-full capsules; null for a full capsule. */
  kindTag: InboxKind | null;
  objective: string | null;
  /** Honest, non-gate wording: a not-safe run reads as "review before continuing", never "blocked". */
  verdictLabel: string;
  verdictTone: VerdictTone;
  /** "3 steps · 2 supported · 0 mismatch · 1 unsupported · 1 do-not-send", or null if no summary. */
  countsLine: string | null;
  agentLabels: string[];
  receiptId: string | null;
  parentLoopId: string | null;
  warningCount: number;
  missingCount: number;
  folder: string;
}

export interface InboxStats {
  count: number;
  shown: number;
  includedPartial: boolean;
  /** Entries with at least one unsupported claim or do-not-send flag. */
  flagged: number;
}

export interface InboxView {
  root: string;
  stats: InboxStats;
  rows: InboxRow[];
}

const n = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numText = (v: number | null | undefined): string =>
  v === null || v === undefined ? "?" : String(v);

/** Honest verdict mapping. Not-safe is framed as "review before continuing", not a block. */
export function verdict(safe: boolean | null): { label: string; tone: VerdictTone } {
  if (safe === true) return { label: "Safe to continue", tone: "ok" };
  if (safe === false) return { label: "Review before continuing", tone: "review" };
  return { label: "No verdict recorded", tone: "muted" };
}

function hasSummary(s: InboxSummary): boolean {
  return [s.total_steps, s.supported, s.mismatches, s.unsupported, s.do_not_send].some(
    (v) => v !== null && v !== undefined
  );
}

export function countsLine(s: InboxSummary): string | null {
  if (!hasSummary(s)) return null;
  return (
    `${numText(s.total_steps)} steps · ${numText(s.supported)} supported · ` +
    `${numText(s.mismatches)} mismatch · ${numText(s.unsupported)} unsupported · ` +
    `${numText(s.do_not_send)} do-not-send`
  );
}

export function agentLabels(agents: InboxAgent[] | null): string[] {
  if (!Array.isArray(agents)) return [];
  return agents
    .map((a) => a.subagent_role || a.agent_id || "")
    .filter((s): s is string => s.length > 0);
}

/** True if an entry carries witnessed gaps a person should look at. */
export function isFlagged(entry: InboxEntry): boolean {
  return n(entry.summary.unsupported) > 0 || n(entry.summary.do_not_send) > 0;
}

export function toInboxRow(entry: InboxEntry): InboxRow {
  const v = verdict(entry.safe_to_continue);
  return {
    id: entry.folder,
    title: entry.name || entry.folderName,
    folderName: entry.folderName,
    kind: entry.kind,
    kindTag: entry.kind === "capsule" ? null : entry.kind,
    objective: entry.objective,
    verdictLabel: v.label,
    verdictTone: v.tone,
    countsLine: countsLine(entry.summary),
    agentLabels: agentLabels(entry.agents),
    receiptId: entry.receipt_id,
    parentLoopId: entry.parent_loop_id,
    warningCount: Array.isArray(entry.warnings) ? entry.warnings.length : 0,
    missingCount: Array.isArray(entry.missing_files) ? entry.missing_files.length : 0,
    folder: entry.folder
  };
}

export function inboxStats(index: InboxIndex): InboxStats {
  return {
    count: index.count,
    shown: index.shown,
    includedPartial: index.included_partial,
    flagged: index.entries.filter(isFlagged).length
  };
}

/** The single transform a screen calls: engine JSON → ordered, screen-ready rows + header stats. */
export function toInboxView(index: InboxIndex): InboxView {
  return {
    root: index.root,
    stats: inboxStats(index),
    rows: index.entries.map(toInboxRow)
  };
}
