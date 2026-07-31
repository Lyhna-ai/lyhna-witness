import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateWaterfallSpec } from "../scripts/validate-waterfall-spec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the one-product waterfall contract keeps truth and review feedback in the shared Witness", () => {
  const spec = readFileSync(path.join(root, "SPEC.md"), "utf8");
  assert.deepEqual(validateWaterfallSpec(spec), []);
});

test("the structural validator rejects removal of identity and currentness rules", () => {
  const spec = readFileSync(path.join(root, "SPEC.md"), "utf8");
  for (const fragment of [
    "`schema` is required and must equal `lyhna-event/v1` before the event enters the reducer.",
    "The complete `lyhna-event/v1` envelope is type- and enum-validated before folding",
    "`sequence` is a non-negative safe integer",
    "`payload` is a JSON object, not null or an array",
    "`source.adapter`, `source.host`, `actor.kind`, and `actor.id` are required non-empty fields.",
    "Every review lifecycle event requires `subject.review_ref`",
    "Every review lifecycle event requires `subject.review_scope`",
    "A diff-scoped review requires `subject.base`, and its currentness key includes that exact base.",
    "Each included path appears exactly once as its final inspected worktree state",
    "RFC 8785 JSON Canonicalization Scheme (JCS)",
    "`content_digest` is `sha256:<64-lowercase-hex>` over the exact raw bytes",
    "From `review_started` onward, a local review of uncommitted material requires",
    "From `review_started` onward, every review lifecycle event requires",
    "The coverage-manifest preimage is exactly",
    "`unavailable_surfaces` and `capture_failures`",
    "\"coverage_digest\": <sealed-coverage-digest>",
    "+ coverage digest."
  ]) {
    const withoutRule = spec.replace(fragment, "");
    assert.notDeepEqual(validateWaterfallSpec(withoutRule), [], `removing ${fragment} must fail validation`);
  }
});
