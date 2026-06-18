// Lyhna Desktop — install snippets (pure, deterministic, honest).
//
// Generates copy-paste "connect your agent through the Lyhna MCP adapter" snippets for common MCP clients.
// The snippet wires the @lyhna/mcp adapter as an stdio MCP server in front of an upstream server the user
// already runs (quick-connect). Wording mirrors the merged, Codex-reviewed website install copy.
//
// Honesty (carried into INSTALL_NOTES, shown beside every snippet):
//  - quick-connect (stdio) witnesses routed calls + seals a receipt chain, but does NOT by itself produce
//    the full claimed-vs-witnessed capsule (that's the standing-service / export-pack flow);
//  - demo mode decides locally and sends nothing to Lyhna; signed mode routes calls to Lyhna's hosted
//    service, so routed args leave the machine;
//  - only calls routed through Lyhna are witnessed; anything else is unwitnessed;
//  - no one-command install / plugin store — confirm the client's exact config path in its own docs.

export type SnippetFormat = "json" | "toml";

export interface AgentTarget {
  id: string;
  label: string;
  format: SnippetFormat;
  /** Where this client's MCP config typically lives (always confirm in the client's own docs). */
  configHint: string;
}

// The agents we give tailored guidance for. JSON `mcpServers` is the common form (Claude Code, Cursor,
// most MCP clients); Codex uses a TOML config. Hermes/local + generic point at the JSON form with a
// docs caveat (we don't invent a config path we're unsure of).
export const AGENT_TARGETS: AgentTarget[] = [
  { id: "claude-code", label: "Claude Code", format: "json", configHint: "Project .mcp.json (or run `claude mcp add`)." },
  { id: "codex", label: "Codex", format: "toml", configHint: "~/.codex/config.toml (Codex uses TOML for MCP servers)." },
  { id: "cursor", label: "Cursor", format: "json", configHint: "~/.cursor/mcp.json (or .cursor/mcp.json in a project)." },
  { id: "hermes", label: "Hermes", format: "json", configHint: "Your Hermes MCP client config — confirm the path in its docs." },
  { id: "generic", label: "Generic MCP agent", format: "json", configHint: "Your MCP client's server config (commonly an mcpServers block)." }
];

const LYHNA_ARGS = ["-y", "@lyhna/mcp", "stdio"];

// Placeholder env: the upstream server to wrap + the loop framing. Values are clearly placeholders the
// user replaces; demo bind mode keeps the decision local and sends nothing to Lyhna.
const ENV_ENTRIES: [string, string][] = [
  ["LYHNA_PROXY_UPSTREAM_COMMAND", "npx"],
  ["LYHNA_PROXY_UPSTREAM_ARGS_JSON", '["-y","@your/mcp-server"]'],
  ["LYHNA_PROXY_LOOP_ID", "my-loop"],
  ["LYHNA_PROXY_GOAL", "what this run is for"],
  ["LYHNA_PROXY_BIND_MODE", "demo"]
];

export function jsonSnippet(): string {
  const env = Object.fromEntries(ENV_ENTRIES);
  return JSON.stringify({ mcpServers: { lyhna: { command: "npx", args: LYHNA_ARGS, env } } }, null, 2);
}

export function tomlSnippet(): string {
  return [
    "[mcp_servers.lyhna]",
    'command = "npx"',
    `args = [${LYHNA_ARGS.map((a) => `"${a}"`).join(", ")}]`,
    "",
    "[mcp_servers.lyhna.env]",
    ...ENV_ENTRIES.map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
  ].join("\n");
}

export function snippetFor(format: SnippetFormat): string {
  return format === "toml" ? tomlSnippet() : jsonSnippet();
}

export const INSTALL_NOTES: string[] = [
  "Quick-connect (stdio) witnesses the tool calls routed through Lyhna and seals a receipt chain. It does not by itself produce the full claimed-vs-witnessed capsule — that comes from the standing-service / export-pack flow (the proxy's QUICKSTART “Path B”).",
  "Demo mode (LYHNA_PROXY_BIND_MODE=demo) decides locally and sends nothing to Lyhna — your upstream tools still do their own network I/O. Signed mode (a LYHNA_API_KEY) routes each tool call through Lyhna's hosted witness service to decide — so your routed tool arguments leave your machine. Choose per how sensitive they are.",
  "Set LYHNA_PROXY_LOOP_ID and LYHNA_PROXY_GOAL so the witnessed calls form a sealed loop; without them the adapter still runs but with the loop disabled.",
  "Lyhna witnesses only the calls routed through it. Anything your agent does outside that path is unwitnessed — never assumed.",
  "There's no one-command install and no plugin-store listing yet. Confirm your client's exact MCP config path and format in its own docs."
];
