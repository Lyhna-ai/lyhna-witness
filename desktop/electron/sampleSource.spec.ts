import { describe, test, expect } from "vitest";
import { sampleRenderArgs, SAMPLE_FOLDER_NAME } from "./sampleSource.js";

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
