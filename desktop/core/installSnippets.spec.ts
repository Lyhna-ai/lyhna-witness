import { describe, test, expect } from "vitest";
import { AGENT_TARGETS, snippetFor, jsonSnippet, tomlSnippet, INSTALL_NOTES } from "./installSnippets.js";

describe("AGENT_TARGETS", () => {
  test("covers the named agents", () => {
    const ids = AGENT_TARGETS.map((a) => a.id);
    expect(ids).toEqual(["claude-code", "codex", "cursor", "hermes", "generic"]);
  });
  test("Codex uses TOML, the rest JSON", () => {
    expect(AGENT_TARGETS.find((a) => a.id === "codex")?.format).toBe("toml");
    expect(AGENT_TARGETS.find((a) => a.id === "claude-code")?.format).toBe("json");
  });
});

describe("snippets", () => {
  test("JSON snippet is valid and wires the @lyhna/mcp stdio adapter in demo mode", () => {
    const parsed = JSON.parse(jsonSnippet());
    expect(parsed.mcpServers.lyhna.command).toBe("npx");
    expect(parsed.mcpServers.lyhna.args).toEqual(["-y", "@lyhna/mcp", "stdio"]);
    expect(parsed.mcpServers.lyhna.env.LYHNA_PROXY_BIND_MODE).toBe("demo");
  });
  test("TOML snippet declares the mcp_servers.lyhna table with the stdio args", () => {
    const t = tomlSnippet();
    expect(t.startsWith("[mcp_servers.lyhna]")).toBe(true);
    expect(t).toContain('args = ["-y", "@lyhna/mcp", "stdio"]');
    expect(t).toContain("[mcp_servers.lyhna.env]");
    expect(t).toContain('LYHNA_PROXY_BIND_MODE = "demo"');
  });
  test("snippetFor picks format", () => {
    expect(snippetFor("toml").startsWith("[mcp_servers.lyhna]")).toBe(true);
    expect(snippetFor("json").startsWith("{")).toBe(true);
  });
});

describe("INSTALL_NOTES honesty", () => {
  test("discloses the signed-mode boundary (args leave the machine)", () => {
    expect(INSTALL_NOTES.some((n) => /leave your machine/i.test(n))).toBe(true);
  });
  test("states only routed calls are witnessed", () => {
    expect(INSTALL_NOTES.some((n) => /witnesses only the calls routed through it/i.test(n))).toBe(true);
  });
  test("does not claim a one-command install or plugin store", () => {
    expect(INSTALL_NOTES.some((n) => /no one-command install/i.test(n))).toBe(true);
  });
  test("clarifies quick-connect is not the full capsule", () => {
    expect(INSTALL_NOTES.some((n) => /does not by itself produce the full/i.test(n))).toBe(true);
  });
});
