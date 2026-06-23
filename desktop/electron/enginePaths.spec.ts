import { describe, test, expect } from "vitest";
import { join } from "node:path";
import { resolveEnginePaths, engineBase, type EnginePathInputs } from "./enginePaths.js";

const REPO = "/home/dev/lyhna-witness";
const RES = "/opt/Lyhna Desktop/resources";

function inputs(over: Partial<EnginePathInputs> = {}): EnginePathInputs {
  return { isPackaged: false, resourcesPath: undefined, repoRoot: REPO, env: {}, ...over };
}

describe("engineBase", () => {
  test("dev (not packaged) → repo root", () => {
    expect(engineBase(inputs())).toBe(REPO);
  });
  test("packaged → <resourcesPath>/engine", () => {
    expect(engineBase(inputs({ isPackaged: true, resourcesPath: RES }))).toBe(join(RES, "engine"));
  });
  test("packaged but no resourcesPath → falls back to repo root (never an undefined base)", () => {
    expect(engineBase(inputs({ isPackaged: true, resourcesPath: undefined }))).toBe(REPO);
  });
});

describe("resolveEnginePaths — dev from source", () => {
  const p = resolveEnginePaths(inputs());
  test("uses the in-repo layout", () => {
    expect(p.engineCli).toBe(join(REPO, "src", "inbox-cli.mjs"));
    expect(p.renderCli).toBe(join(REPO, "src", "cli.mjs"));
    expect(p.sampleInput).toBe(join(REPO, "demo", "live-loop-witness-input.json"));
    expect(p.exampleLibrary).toBe(join(REPO, "examples"));
  });
});

describe("resolveEnginePaths — packaged", () => {
  const p = resolveEnginePaths(inputs({ isPackaged: true, resourcesPath: RES }));
  test("resolves under <resourcesPath>/engine, not the (absent) repo", () => {
    expect(p.engineCli).toBe(join(RES, "engine", "src", "inbox-cli.mjs"));
    expect(p.renderCli).toBe(join(RES, "engine", "src", "cli.mjs"));
    expect(p.sampleInput).toBe(join(RES, "engine", "demo", "live-loop-witness-input.json"));
    expect(p.exampleLibrary).toBe(join(RES, "engine", "examples"));
  });
});

describe("resolveEnginePaths — LYHNA_ENGINE_* overrides always win", () => {
  const env = {
    LYHNA_ENGINE_CLI: "/x/inbox.mjs",
    LYHNA_RENDER_CLI: "/x/render.mjs",
    LYHNA_SAMPLE_INPUT: "/x/input.json",
    LYHNA_EXAMPLE_LIBRARY: "/x/examples"
  };
  test("override beats the dev layout", () => {
    const p = resolveEnginePaths(inputs({ env }));
    expect(p).toEqual({
      engineCli: "/x/inbox.mjs",
      renderCli: "/x/render.mjs",
      sampleInput: "/x/input.json",
      exampleLibrary: "/x/examples"
    });
  });
  test("override beats the packaged layout too", () => {
    const p = resolveEnginePaths(inputs({ isPackaged: true, resourcesPath: RES, env }));
    expect(p).toEqual({
      engineCli: "/x/inbox.mjs",
      renderCli: "/x/render.mjs",
      sampleInput: "/x/input.json",
      exampleLibrary: "/x/examples"
    });
  });
  test("a single override is independent of the others", () => {
    const p = resolveEnginePaths(inputs({ env: { LYHNA_RENDER_CLI: "/only/render.mjs" } }));
    expect(p.renderCli).toBe("/only/render.mjs");
    expect(p.engineCli).toBe(join(REPO, "src", "inbox-cli.mjs"));
  });
});
