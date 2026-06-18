// Lyhna Desktop — local capsule indexer (the receipt inbox's read model).
//
// This is the first useful desktop object: a LOCAL FILE INDEX over Work Receipt Capsule folders the
// witness engine already produces. It does not run agents, call the network, or invent facts. It reads
// what the capsule files on disk SAY and returns a compact, deterministic inbox summary — nothing more.
//
// Honesty boundary (mirrors the receipt's own ceiling): the indexer asserts nothing about the work. It
// only reports what `capsule.json` (or, in a clearly-marked degraded mode, `handoff.json`) already
// recorded. Absent fields are reported as absent (null) — never fabricated. A malformed capsule becomes
// an `unreadable` entry, never a crash.
//
// Determinism by contract: no clock, no randomness, no model calls. Ordering is stable (newest by an
// embedded capsule timestamp when present, otherwise by folder name). Same folder tree ⇒ same output.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const INDEXER_SCHEMA = "lyhna-inbox/v0";
export const CAPSULE_SCHEMA = "lyhna-capsule/v1";

// The receipt files a full capsule is expected to contain (the handoff trio + the index pair). Used to
// flag a known file that a manifest declares but disk is missing, and to surface what a degraded
// (handoff-only) folder actually has. Directory carriers (okf/, pam/) are optional and handled via the
// manifest's own artifact list, not this set.
const KNOWN_RECEIPT_FILES = Object.freeze([
  "CAPSULE.md",
  "capsule.json",
  "HANDOFF.md",
  "handoff.json",
  "next-ai-prompt.md"
]);

const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strOrNull = (v) => (typeof v === "string" && v.length > 0 ? v : null);

// Basename that tolerates BOTH POSIX and Windows separators, regardless of the host platform — a folder
// path captured on Windows ("C:\\Receipts\\loop-1") still indexes correctly when read elsewhere.
export function folderBaseName(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(p);
}

// Pull the five verdict counts from a summary object without fabricating: a count that isn't a finite
// number comes back null, and `incomplete` flags that at least one was absent/garbled.
function readSummary(src) {
  const s = src && typeof src === "object" ? src : {};
  const summary = {
    total_steps: numOrNull(s.total_steps),
    supported: numOrNull(s.supported),
    mismatches: numOrNull(s.mismatches),
    unsupported: numOrNull(s.unsupported),
    do_not_send: numOrNull(s.do_not_send)
  };
  const incomplete = Object.values(summary).some((v) => v === null);
  return { summary, incomplete };
}

// Compact, non-fabricating projection of the run-level agent attribution. Only copies keys that are
// actually present on each agent record — an agent whose tool path was never routed through Lyhna does
// not appear in the source, and we never invent one.
function projectAgents(agents) {
  if (!Array.isArray(agents) || agents.length === 0) return null;
  return agents.map((a) => {
    const o = {};
    if (a && typeof a === "object") {
      if ("agent_id" in a) o.agent_id = a.agent_id;
      if ("subagent_role" in a) o.subagent_role = a.subagent_role;
      if ("steps" in a) o.steps = a.steps;
      if ("all_supported" in a) o.all_supported = a.all_supported;
      if ("has_unsupported" in a) o.has_unsupported = a.has_unsupported;
      if ("nonsupported_statuses" in a) o.nonsupported_statuses = a.nonsupported_statuses;
    }
    return o;
  });
}

// Build a stable, fixed-key-order inbox entry. All callers route through this so the shape never drifts.
function makeEntry(fields) {
  return {
    folder: fields.folder,
    folderName: folderBaseName(fields.folder),
    kind: fields.kind, // "capsule" | "partial" | "unreadable"
    name: fields.name ?? null,
    objective: fields.objective ?? null,
    safe_to_continue: fields.safe_to_continue ?? null,
    summary: fields.summary ?? readSummary(null).summary,
    parent_loop_id: fields.parent_loop_id ?? null,
    receipt_id: fields.receipt_id ?? null,
    agents: fields.agents ?? null,
    artifacts: fields.artifacts ?? [],
    missing_files: fields.missing_files ?? [],
    timestamp: fields.timestamp ?? null,
    warnings: fields.warnings ?? []
  };
}

/**
 * Summarize one parsed `capsule.json` manifest into an inbox entry. PURE — no filesystem access.
 * @param {object} manifest  the parsed capsule.json object.
 * @param {object} opts
 * @param {string} opts.folder        the capsule folder path (as you want it echoed back).
 * @param {Set<string>|string[]} [opts.presentNames]  names present on disk in the folder, so the entry
 *        can flag a declared artifact that isn't actually there. Omit for a pure data summary.
 * @returns {object} a stable inbox entry (kind "capsule").
 */
export function summarizeCapsuleManifest(manifest, opts = {}) {
  const folder = opts.folder ?? "";
  const warnings = [];
  const m = manifest && typeof manifest === "object" ? manifest : {};

  if (m.schema && m.schema !== CAPSULE_SCHEMA) {
    warnings.push(`unexpected capsule schema: ${String(m.schema)}`);
  }

  const verdict = m.verdict && typeof m.verdict === "object" ? m.verdict : {};
  const { summary, incomplete } = readSummary(verdict.summary);
  if (!verdict || typeof verdict.safe_to_continue !== "boolean") {
    warnings.push("capsule.json has no boolean verdict.safe_to_continue");
  }
  if (incomplete) warnings.push("capsule.json verdict summary is incomplete");

  // Declared artifacts → their paths (deduped, original order). Missing-on-disk check only runs when the
  // caller supplied the folder's present names.
  const declared = Array.isArray(m.artifacts) ? m.artifacts : [];
  const artifacts = declared
    .map((a) => (a && typeof a === "object" ? a.path : a))
    .filter((p) => typeof p === "string" && p.length > 0);

  let missing_files = [];
  if (opts.presentNames) {
    const present = opts.presentNames instanceof Set ? opts.presentNames : new Set(opts.presentNames);
    missing_files = artifacts.filter((p) => !present.has(p.replace(/\/+$/, "")));
    if (missing_files.length) {
      warnings.push(`declared artifacts missing on disk: ${missing_files.join(", ")}`);
    }
  }

  return makeEntry({
    folder,
    kind: "capsule",
    name: strOrNull(m.name),
    objective: strOrNull(m.objective),
    safe_to_continue: typeof verdict.safe_to_continue === "boolean" ? verdict.safe_to_continue : null,
    summary,
    parent_loop_id: strOrNull(m.parent_loop_id),
    receipt_id: strOrNull(m.receipt_id),
    agents: projectAgents(m.agents),
    artifacts,
    missing_files,
    timestamp: strOrNull(m.timestamp),
    warnings
  });
}

/**
 * Summarize a parsed `handoff.json` into a DEGRADED inbox entry (kind "partial"), for a folder that has
 * a machine receipt but no `capsule.json`. PURE — no filesystem access. Clearly marked as not a full
 * capsule. The handoff carries the same verdict/summary/spine the manifest would, so those are honest to
 * surface; there is no declared artifact list, so `artifacts` stays empty.
 * @param {object} handoff  the parsed handoff.json object.
 * @param {object} opts
 * @param {string} opts.folder
 * @returns {object} a stable inbox entry (kind "partial").
 */
export function summarizeHandoff(handoff, opts = {}) {
  const folder = opts.folder ?? "";
  const h = handoff && typeof handoff === "object" ? handoff : {};
  const { summary } = readSummary(h.summary);

  return makeEntry({
    folder,
    kind: "partial",
    name: null, // a handoff carries no capsule name — do not invent one from the folder
    objective: strOrNull(h.objective),
    safe_to_continue: typeof h.safe_to_continue === "boolean" ? h.safe_to_continue : null,
    summary,
    parent_loop_id: strOrNull(h.parent_loop_id),
    receipt_id: strOrNull(h.receipt_id),
    agents: projectAgents(h.agents),
    artifacts: [],
    missing_files: [],
    timestamp: null,
    warnings: ["no capsule.json — degraded entry indexed from handoff.json; not a full capsule"]
  });
}

// Read + parse a JSON file, returning { ok, value } or { ok:false, error }. Never throws on bad content.
function readJson(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    return { ok: false, error: `could not read ${folderBaseName(path)}: ${err.message}` };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: `${folderBaseName(path)} is not valid JSON: ${err.message}` };
  }
}

// Index a single capsule folder into an entry, or return null if it is not a capsule at all (neither
// capsule.json nor handoff.json present). Touches the filesystem.
function indexFolder(folder, names, opts) {
  const present = new Set(names);
  const hasCapsule = present.has("capsule.json");
  const hasHandoff = present.has("handoff.json");

  if (hasCapsule) {
    const parsed = readJson(join(folder, "capsule.json"));
    if (!parsed.ok) {
      return makeEntry({ folder, kind: "unreadable", warnings: [parsed.error] });
    }
    return summarizeCapsuleManifest(parsed.value, { folder, presentNames: present });
  }

  if (hasHandoff && opts.includePartial) {
    const parsed = readJson(join(folder, "handoff.json"));
    if (!parsed.ok) {
      return makeEntry({ folder, kind: "unreadable", warnings: [parsed.error] });
    }
    return summarizeHandoff(parsed.value, { folder });
  }

  return null; // not a capsule — ignored by the inbox
}

// Deterministic ordering: most relevant first. An entry whose capsule recorded a parseable timestamp
// sorts ahead of one without (newest INSTANT first); ties and timestampless/unparseable entries fall
// back to folder name. Timestamps are compared as instants (Date.parse → epoch ms) so an ISO string with
// a non-`Z` offset (e.g. "…+02:00") orders correctly against a `Z` time — lexicographic comparison would
// not. No clock is read — Date.parse only parses the string the capsule itself recorded.
function compareEntries(a, b) {
  const ai = a.timestamp ? Date.parse(a.timestamp) : NaN;
  const bi = b.timestamp ? Date.parse(b.timestamp) : NaN;
  const av = Number.isFinite(ai);
  const bv = Number.isFinite(bi);
  if (av && bv) {
    if (ai !== bi) return bi - ai; // newer (larger instant) first
  } else if (av && !bv) {
    return -1;
  } else if (!av && bv) {
    return 1;
  }
  if (a.folderName !== b.folderName) return a.folderName < b.folderName ? -1 : 1;
  return a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0;
}

/**
 * Index a local receipt-library folder: scan its immediate child folders and summarize each valid
 * capsule. Reads the filesystem; reads only what the capsule files say.
 *
 * @param {string} root  path to the receipt-library folder.
 * @param {object} [opts]
 * @param {boolean} [opts.includePartial=true]  include folders that have handoff.json but no
 *        capsule.json as degraded ("partial") entries. Set false to index full capsules only.
 * @returns {{ schema:string, root:string, count:number, entries:object[] }}
 */
export function indexReceiptLibrary(root, opts = {}) {
  const includePartial = opts.includePartial !== false;
  if (typeof root !== "string" || root.length === 0) {
    throw new TypeError("indexReceiptLibrary: root must be a non-empty path string");
  }

  let dirents;
  try {
    dirents = readdirSync(root, { withFileTypes: true });
  } catch (err) {
    throw new Error(`indexReceiptLibrary: cannot read receipt root "${root}": ${err.message}`);
  }

  const entries = [];
  for (const d of dirents) {
    // Resolve real directories, following the rare case where withFileTypes reports a non-dir we still
    // want to confirm (e.g. a symlink). Skip anything that isn't a directory.
    let isDir = d.isDirectory();
    if (!isDir && d.isSymbolicLink && d.isSymbolicLink()) {
      try {
        isDir = statSync(join(root, d.name)).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (!isDir) continue;

    const folder = join(root, d.name);
    let names;
    try {
      names = readdirSync(folder);
    } catch {
      continue; // unreadable child folder — skip rather than crash the whole index
    }
    const entry = indexFolder(folder, names, { includePartial });
    if (entry) entries.push(entry);
  }

  entries.sort(compareEntries);
  return { schema: INDEXER_SCHEMA, root, count: entries.length, entries };
}
