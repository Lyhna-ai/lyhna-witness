import { describe, test, expect } from "vitest";
import { isSampleFolder, SAMPLE_FOLDER_NAME } from "./sample.js";

describe("isSampleFolder", () => {
  test("matches the base sample folder and numbered siblings", () => {
    expect(isSampleFolder("/lib/lyhna-sample-receipt")).toBe(true);
    expect(isSampleFolder("/lib/lyhna-sample-receipt-2")).toBe(true);
    expect(isSampleFolder("C:\\lib\\lyhna-sample-receipt-17")).toBe(true);
    expect(isSampleFolder("lyhna-sample-receipt")).toBe(true);
  });
  test("does not match real receipts or lookalikes", () => {
    expect(isSampleFolder("/lib/agent-team")).toBe(false);
    expect(isSampleFolder("/lib/lyhna-sample-receipt-notes")).toBe(false);
    expect(isSampleFolder("/lib/my-lyhna-sample-receipt")).toBe(false);
    expect(isSampleFolder("/lib/lyhna-sample-receipts")).toBe(false);
  });
  test("constant is the canonical sample name", () => {
    expect(SAMPLE_FOLDER_NAME).toBe("lyhna-sample-receipt");
  });
});
