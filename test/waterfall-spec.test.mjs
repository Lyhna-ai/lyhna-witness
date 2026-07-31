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
