import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateWaterfallSpec } from "../scripts/validate-waterfall-spec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Slice 2 keeps exact-head persistence, de-duplication, and verified-read acknowledgement", () => {
  const spec = readFileSync(path.join(root, "SPEC.md"), "utf8");
  assert.deepEqual(validateWaterfallSpec(spec), []);
});

test("the waterfall validator rejects removal of every acceptance-critical rule", () => {
  const spec = readFileSync(path.join(root, "SPEC.md"), "utf8");
  for (const fragment of [
    "`pull_request_diff` requires an exact base",
    "event-prefix sequence, the prefix chain digest,",
    "deterministic `finding_ref` is the SHA-256 of the canonical subject",
    "\"reviewer_ref\": \"stable reviewer identity\"",
    "never creates a second inline finding",
    "read `REPORT.md` immediately",
    "Missing, unreadable, or altered Markdown produces no bytes and no verified-read event",
    "exactly one accepted predecessor: a prior successful `report_read_verified`",
    "Report\navailability, generation, publication, delivery,",
    "does not mean the audience agreed, the finding was repaired, or the reviewed work was correct"
  ]) {
    assert.notDeepEqual(
      validateWaterfallSpec(spec.replace(fragment, "")),
      [],
      `removing ${fragment} must fail validation`
    );
  }
});
