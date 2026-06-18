// Lyhna Desktop — parse + validate the engine's inbox JSON (pure, zero-dep, testable).
//
// The desktop never re-implements receipt/capsule semantics: it runs the lyhna-witness inbox CLI
// (`inbox-cli.mjs --json`, schema `lyhna-inbox/v0`) and parses its stdout here. This module only
// validates the envelope shape and hands back the engine's own entries untouched — it adds no trust
// claim of its own. Kept pure so it unit-tests headlessly and runs in the renderer.

import type { InboxIndex, InboxEntry } from "./inboxView.js";

export const INBOX_SCHEMA = "lyhna-inbox/v0";

export class InboxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboxParseError";
  }
}

/**
 * Parse the stdout of `inbox-cli.mjs --json` into a typed InboxIndex. Throws InboxParseError with a
 * clear message on malformed output. Trusts the engine's entry shape (the engine is the source of
 * truth) but coerces the envelope defensively so a screen never crashes on a missing scalar.
 */
export function parseInboxIndex(text: string): InboxIndex {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new InboxParseError(`inbox output was not valid JSON: ${(e as Error).message}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new InboxParseError("inbox output was not a JSON object");
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.entries)) {
    throw new InboxParseError("inbox output is missing an entries array");
  }
  const entries = d.entries as InboxEntry[];
  return {
    schema: typeof d.schema === "string" ? d.schema : INBOX_SCHEMA,
    root: typeof d.root === "string" ? d.root : "",
    included_partial: Boolean(d.included_partial),
    count: typeof d.count === "number" ? d.count : entries.length,
    shown: typeof d.shown === "number" ? d.shown : entries.length,
    entries
  };
}
