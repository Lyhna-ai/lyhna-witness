# Private / Local AI Install Notes

> **Keep your model private. Prove what its tools did.**
>
> Lyhna witnesses at the **tool-call boundary**, not at the model. So it is model-agnostic: it works the
> same whether the agent is driven by OpenAI, Claude, Codex, a local Ollama / Qwen / Llama, or a private
> company-hosted model — **as long as the agent's tool calls route through the MCP/tool path Lyhna
> witnesses.** The model's weights, prompts, and chat history never have to touch Lyhna. Lyhna is even
> content-blind at the witnessed boundary: the judgment ledger records the tool **name**, not its
> arguments.
>
> _Written 2026-06-16. Companion to the proxy's `docs/QUICKSTART.md` (the guided setup source)._

---

## 1. The one rule (make it explicit)

**Lyhna works when, and only when, the agent's actions cross a tool-call boundary that routes through the
Lyhna proxy.** It witnesses *tool calls*, compares them to the agent's *claims*, and prints the receipt.

It follows that:

- **Lyhna does not work on raw chat.** A model that only emits text — no tool calls — produces nothing
  that crosses a tool boundary, so there is nothing to witness. Lyhna makes no claim about what a model
  "said" or "thought"; that is squarely outside the honesty ceiling.
- **Lyhna does not need access to your model.** It sits between the agent's MCP client and the upstream
  tools. The model can be fully local and offline; Lyhna still witnesses the tool calls it triggers.

If your agent uses tools through MCP (or any path you can route through the proxy), Lyhna fits. If it only
chats, it does not — and that is the honest boundary, not a limitation to paper over.

## 2. Why this is the *right* fit for private / local AI

Teams run local or company-hosted models precisely because they don't want prompts, data, or weights
leaving their environment. Lyhna's witness boundary is compatible with that by construction:

- **The model stays private.** Lyhna never sees the model, the prompt, or the completion. It sees the
  tool calls the agent makes.
- **Content-blind at the boundary.** The witnessed ledger records the tool **name** and a hash of what
  the runtime returned — not the arguments. You get provenance ("a `write_file` call crossed the
  boundary and returned") without exporting the payload.
- **Offline-capable.** With `LYHNA_PROXY_BIND_MODE=demo` the whole loop runs with no network and no Lyhna
  account (receipts are unsigned — see §5). Signed receipts use a hosted bind, but verification of any
  pack is fully offline with the `lyhna-verify` tool.

**The pitch, in one line: keep your model private — prove what its tools did.**

## 3. Who this covers (model-neutral)

Lyhna is indifferent to the model behind the agent. It works with:

- **Hosted models:** OpenAI, Claude, and Codex-style agents.
- **Local models:** Ollama, Qwen, local Llama — anything you run on your own hardware.
- **Private/company-hosted models:** internal or VPC-hosted models behind your own gateway.

The only requirement is the same for all of them: **the agent's tool calls route through the witnessed
MCP/tool path.** No model is privileged; none is excluded.

## 4. How it wires up (any MCP-capable local harness)

The wiring follows the proxy's `docs/QUICKSTART.md` and does not change with the model. **Setup is a
guided private-beta process today, not a public self-serve install** — the proxy package and any hosted
key are invite-gated during the beta, and the receipt-render CLI runs from a source checkout (the
`lyhna-witness` repo). The shape:

1. Point your agent's MCP client at the Lyhna proxy instead of directly at the upstream MCP server — a
   single MCP-client config block that runs the proxy in front of the real upstream you already use (e.g.
   `@modelcontextprotocol/server-filesystem`), per the proxy's guided QUICKSTART. (For an offline trial
   from a source checkout, run with `LYHNA_PROXY_BIND_MODE=demo` — no key, unsigned receipts.)
2. The proxy wraps that upstream, witnesses each `tools/call`, and captures the agent's `record_claim`
   claims. Your **local model drives the agent exactly as before** — it just talks to the proxy URL.
3. Close the loop, `export-pack` → `witness-input.json`, render the receipt with the witness CLI.

Whether the agent loop is driven by Ollama on the same box or a hosted model over an API changes nothing
about steps 1–3. Lyhna only ever sees the tool path.

## 5. What this does NOT claim (the honesty ceiling, restated for this context)

- It does **not** witness the model's reasoning, prompt, or output — only tool calls.
- It does **not** verify outcomes, delivery, correctness, or anything outside the observed tool path.
- An unsigned (`demo`-mode / local) run yields an honest receipt of *what crossed the boundary*, but the
  receipts are **not cryptographically signed** — `lyhna-verify` will report `all_receipts_verified:
  false`. That is the truthful state of an offline run, not a defect.
- "Works with local models" means "works with local *agents whose tools route through the proxy*." It is
  not a claim that Lyhna inspects or improves the model.

## 6. Recommended buyer-facing wording (for owner sign-off)

The line **"Keep your model private. Prove what its tools did."** is a clean, honesty-ceiling-safe hook
for the private/local-AI buyer. It could live on the homepage or install page. Because buyer-facing web
copy is owner-held, this note records the wording and the rationale; putting it on the live site is an
owner decision (it adds no outcome/delivery/correctness claim and no pricing/one-command/lyhna.com
claim, so it is within the established copy guardrails).
