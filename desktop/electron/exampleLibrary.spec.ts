import { describe, test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveExampleLibrary, BUNDLED_EXAMPLES_DIRNAME } from "./exampleLibrary.js";

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("resolveExampleLibrary — dev (not packaged)", () => {
  test("returns the bundled examples dir unchanged, copies nothing", () => {
    const examples = tmp("lyhna-ex-src-");
    writeFileSync(join(examples, "marker"), "x");
    const userData = tmp("lyhna-ud-");
    const out = resolveExampleLibrary({ isPackaged: false, exampleLibrary: examples, userDataDir: userData });
    expect(out).toBe(examples);
    expect(readdirSync(userData)).toEqual([]); // nothing materialized
  });
});

describe("resolveExampleLibrary — packaged", () => {
  test("materializes a writable per-user copy and returns it", () => {
    const examples = tmp("lyhna-ex-src-");
    mkdirSync(join(examples, "live-loop"));
    writeFileSync(join(examples, "live-loop", "capsule.json"), "{}");
    const userData = tmp("lyhna-ud-");

    const out = resolveExampleLibrary({ isPackaged: true, exampleLibrary: examples, userDataDir: userData });

    expect(out).toBe(join(userData, BUNDLED_EXAMPLES_DIRNAME));
    expect(existsSync(join(out, "live-loop", "capsule.json"))).toBe(true);
  });

  test("creates userData if it does not exist yet", () => {
    const examples = tmp("lyhna-ex-src-");
    writeFileSync(join(examples, "f"), "x");
    const base = tmp("lyhna-ud-");
    const userData = join(base, "nested", "userData"); // does not exist

    const out = resolveExampleLibrary({ isPackaged: true, exampleLibrary: examples, userDataDir: userData });
    expect(existsSync(join(out, "f"))).toBe(true);
  });

  test("idempotent: an existing copy is reused, never clobbered", () => {
    const examples = tmp("lyhna-ex-src-");
    writeFileSync(join(examples, "orig"), "from-bundle");
    const userData = tmp("lyhna-ud-");

    const first = resolveExampleLibrary({ isPackaged: true, exampleLibrary: examples, userDataDir: userData });
    // Simulate a sample the user rendered into the writable copy.
    writeFileSync(join(first, "lyhna-sample-receipt"), "user-sample");

    const second = resolveExampleLibrary({ isPackaged: true, exampleLibrary: examples, userDataDir: userData });
    expect(second).toBe(first);
    expect(readFileSync(join(second, "lyhna-sample-receipt"), "utf8")).toBe("user-sample"); // not clobbered
  });
});
