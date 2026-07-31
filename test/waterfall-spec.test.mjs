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
    "`source.adapter`, `source.host`, `actor.kind`, and `actor.id` are required non-empty fields.",
    "Every review lifecycle event requires `subject.review_ref`",
    "A diff-scoped review requires `subject.base`, and its currentness key includes that exact base.",
    "Each included path appears exactly once as its final inspected worktree state"
  ]) {
    const withoutRule = spec.replace(fragment, "");
    assert.notDeepEqual(validateWaterfallSpec(withoutRule), [], `removing ${fragment} must fail validation`);
  }
});
