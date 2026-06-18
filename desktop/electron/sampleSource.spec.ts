import { describe, test, expect } from "vitest";
import { sampleRenderArgs, pickSampleFolderName, SAMPLE_FOLDER_NAME } from "./sampleSource.js";

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

describe("pickSampleFolderName (never overwrite)", () => {
  test("uses the base name when free", () => {
    expect(pickSampleFolderName(() => false)).toBe("lyhna-sample-receipt");
  });
  test("suffixes to the first unused name on collision", () => {
    const taken = new Set(["lyhna-sample-receipt", "lyhna-sample-receipt-2"]);
    expect(pickSampleFolderName((n) => taken.has(n))).toBe("lyhna-sample-receipt-3");
  });
  test("throws if no unused name is available", () => {
    expect(() => pickSampleFolderName(() => true)).toThrow(/unused sample folder/);
  });
});
