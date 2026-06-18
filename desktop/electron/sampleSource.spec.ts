import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleRenderArgs, reserveSampleFolder, SAMPLE_FOLDER_NAME } from "./sampleSource.js";

describe("sampleRenderArgs", () => {
  test("renders the input into outDir with both carrier bundles, in order", () => {
    expect(sampleRenderArgs("/engine/src/cli.mjs", "/engine/demo/sample.json", "/lib/lyhna-sample-receipt")).toEqual([
      "/engine/src/cli.mjs",
      "/engine/demo/sample.json",
      "/lib/lyhna-sample-receipt",
      "--okf",
      "--pam"
    ]);
  });

  test("sample folder name is stable and clearly a sample", () => {
    expect(SAMPLE_FOLDER_NAME).toBe("lyhna-sample-receipt");
  });
});

describe("reserveSampleFolder (atomic, never overwrite)", () => {
  test("reserves the base name in an empty library and creates it", () => {
    const lib = mkdtempSync(join(tmpdir(), "lyhna-reserve-"));
    const dir = reserveSampleFolder(lib);
    expect(dir).toBe(join(lib, "lyhna-sample-receipt"));
    expect(existsSync(dir)).toBe(true);
  });
  test("two reservations yield two distinct, real folders (no overwrite, no collision)", () => {
    const lib = mkdtempSync(join(tmpdir(), "lyhna-reserve-"));
    const a = reserveSampleFolder(lib);
    const b = reserveSampleFolder(lib);
    expect(a).not.toBe(b);
    expect(b).toBe(join(lib, "lyhna-sample-receipt-2"));
    expect(existsSync(a)).toBe(true);
    expect(existsSync(b)).toBe(true);
  });
  test("throws when the library root does not exist", () => {
    const base = mkdtempSync(join(tmpdir(), "lyhna-reserve-"));
    expect(() => reserveSampleFolder(join(base, "does-not-exist"))).toThrow();
  });
});
