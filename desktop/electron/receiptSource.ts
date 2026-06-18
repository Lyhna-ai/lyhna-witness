// Lyhna Desktop — receipt file reader (node-only transport; electron-free).
//
// Reads the files of ONE capsule folder from disk and returns them raw. It parses nothing and judges
// nothing — shaping/validation lives in ../core/receiptDetail. Kept free of any `electron` import so it
// can be exercised by a plain-node harness in a headless environment.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface ReceiptFilesRaw {
  folder: string;
  handoffMarkdown: string | null;
  capsuleJson: string | null;
  handoffJson: string | null;
  presentNames: string[];
}

async function readIfPresent(folder: string, name: string): Promise<string | null> {
  try {
    return await readFile(join(folder, name), "utf8");
  } catch {
    return null;
  }
}

/** Read a capsule folder's receipt files. Missing files come back as null rather than throwing. */
export async function readReceipt(folder: string): Promise<ReceiptFilesRaw> {
  let presentNames: string[] = [];
  try {
    presentNames = await readdir(folder);
  } catch {
    presentNames = [];
  }
  const [handoffMarkdown, capsuleJson, handoffJson] = await Promise.all([
    readIfPresent(folder, "HANDOFF.md"),
    readIfPresent(folder, "capsule.json"),
    readIfPresent(folder, "handoff.json")
  ]);
  return { folder, handoffMarkdown, capsuleJson, handoffJson, presentNames };
}
