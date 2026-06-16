# PAM Schema Validation

> **Verdict: KEEP "PAM-shaped." Lyhna's export does NOT validate against any formal published PAM
> schema.** There is no single canonical "PAM" standard to be compatible with: the acronym maps to at
> least three unrelated specifications. Against the closest one (Portable AI Memory v1.0), Lyhna fails the
> *required* envelope/structure — the `schema` value, `schema_version`, `owner.id`, and a single-file
> inline `memories[]` — so it is non-conformant on those grounds. (It also omits `confidence` scores and
> timestamps on principle, but those are *optional* in the comparator, so they are not what blocks
> validation; Lyhna's invariants and conformance do not actually conflict there.) The existing marketing
> wording ("PAM-shaped" / `lyhna-pam/v0`) and the in-artifact `conformance` string are accurate and should
> not change to "PAM-compatible."
>
> _Reviewed 2026-06-16 against the current PAM landscape. Lyhna PAM: `lyhna-pam/v0`
> (`src/pam.mjs`, `examples/live-loop/pam/`)._

---

## 1. Objective

Determine whether Lyhna's current PAM export (`pam/manifest.json` + `pam/memories.jsonl`) can honestly
be called **PAM-compatible**, by comparing it to the current best available PAM/schema reference. If it
validates, document the version and why. If it does not, keep "PAM-shaped" and list the exact gaps.

## 2. The PAM landscape — there is no single standard

A field-honest first finding: **"PAM" is an overloaded acronym** with no single owning body. The current
candidates a buyer or auditor could mean:

| Name | What it actually is | Format | Relevance to Lyhna |
| --- | --- | --- | --- |
| **Portable AI Memory** (`portable-ai-memory`) | A JSON interchange format for *user* AI memories across providers ("vCard for AI memories") | Single JSON file, `schema_version` "1.0" | **Closest match** — a memory interchange JSON. Used as the primary comparator below. |
| **Portable Agent Memory** (arXiv 2605.11032) | A research protocol for provenance-verified memory transfer; content-addressable entries on a Merkle-DAG provenance graph | JSON-first + optional CBOR; Python SDK | Closest in *spirit* (provenance/tamper-evidence) but a research protocol, not a locked validatable schema |
| **Agent Memory Protocol (AMP)** | Markdown-first, graph-native (wiki-links), directory-portable agent memory | Markdown + directory | Different surface (markdown/dir), not a JSON record schema |
| **Portable Agent Manifest (PAM)** (jsonagents.org) | A *capability manifest* describing an agent's tools/governance — **not memory at all** | JSON Schema 2020-12 | Not applicable: different meaning of "PAM" |

**Consequence:** "PAM-compatible" is not a claim anyone can currently verify, because there is no single
"PAM" to be compatible *with*. This alone justifies keeping the hedged "PAM-shaped" wording, independent
of the field-level gaps below.

## 3. Comparator: Portable AI Memory v1.0 (the closest concrete schema)

Reference envelope and record (from the published spec):

- **Envelope (required):** `schema` = `"portable-ai-memory"`, `schema_version` = `"1.0"`, `owner.id`,
  `memories[]`. Optional: `export_id`, `export_date`, `export_type`, `owner.did`.
- **Memory record:** `id`, `type` (one of 11 *user-memory* types: facts, preferences, skills, goals,
  relationships, instructions, context, identity, environment, projects, custom), `content`,
  `content_hash` (SHA-256), `temporal.created_at`, `confidence.initial` (0.0–1.0),
  `provenance.{platform, extraction_method}`.
- **File format:** a **single JSON file** with `memories` as an inline array.

## 4. Field-by-field gap analysis (Lyhna `lyhna-pam/v0` vs Portable AI Memory v1.0)

Portable AI Memory v1.0 mandates only four things: `schema`, `schema_version`, `owner.id`, and
`memories[]` (everything else on a record is optional). So the table below separates **hard validation
blockers** (the required envelope/structure) from **optional divergences** (record fields Lyhna shapes
differently or omits — these would *not* fail a validator on their own).

**Hard blockers (these alone make Lyhna fail validation):**

| Aspect | Portable AI Memory v1.0 | Lyhna `lyhna-pam/v0` | Blocks validation? |
| --- | --- | --- | --- |
| Envelope `schema` value | `"portable-ai-memory"` (required) | `"lyhna-pam/v0"` | ❌ wrong required value |
| `schema_version` | `"1.0"` (required) | *absent* (uses `pam_projection: "v0"`) | ❌ missing required field |
| `owner` / `owner.id` | **required** | *absent* (no owner concept) | ❌ missing required field |
| `memories` | **inline array, single file** | `memories_file: "memories.jsonl"` indirection (manifest + separate JSONL) | ❌ structural mismatch (no inline `memories[]`) |

**Optional divergences (NOT validation failures — Lyhna shapes/omits these by choice):**

| Aspect | Portable AI Memory v1.0 (optional) | Lyhna `lyhna-pam/v0` | Note |
| --- | --- | --- | --- |
| Record `type` field | `type`, 11 user-memory types | `memory_type`, 5 cognitive types (only `identity` overlaps) | field name + vocabulary differ |
| `content_hash` | SHA-256 per record (optional) | *absent* on memory items | omitted |
| `temporal.created_at` | timestamp (optional) | *absent* | omitted by design — determinism (§5) |
| `confidence.initial` | 0.0–1.0 score (optional) | *absent* | omitted by design — honesty ceiling (§5) |
| `provenance` | `{platform, extraction_method}` (optional) | `{source, lyhna_schema, evidence_status, handoff_resource}` | different shape |

**Result: Lyhna does not validate as Portable AI Memory v1.0** — but specifically because of the four
**required** envelope/structure items above, *not* the optional record fields. (Even if every optional
field were dropped from the comparison, the missing `schema`/`schema_version`/`owner.id` and the absence
of an inline `memories[]` array still fail it.) It is a *projection inspired by* the same idea, not a
conformant instance — i.e., genuinely **PAM-shaped**.

## 5. Two omissions are principled — and, helpfully, optional in the comparator

Two fields Lyhna omits are things it would refuse to emit on principle. The good news for any future
conformance work is that **both are optional in Portable AI Memory v1.0**, so omitting them costs nothing
for validation — Lyhna's invariants and PAM-conformance do **not** conflict on these axes:

- **No `confidence` score.** The honesty ceiling explicitly forbids treating *agent confidence as
  evidence* (it is in the artifact's own `honesty_ceiling.never_asserts`). A `confidence.initial: 0.92`
  on a witnessed memory would invite exactly the misread Lyhna exists to prevent. Lyhna carries
  `evidence_status` instead — provenance, not self-assessed confidence. The comparator marks `confidence`
  optional, so leaving it out is fully conformant.
- **No timestamps (`export_date` / `temporal.created_at`).** The labeler/generator is deterministic by
  contract — **no clock** — so the same input is byte-identical output (the drift gates enforce this).
  Emitting wall-clock timestamps would break determinism. These fields are also optional in the
  comparator. (A caller *may* pass a `timestamp` option, but the committed canonical artifact omits it.)

So conformance would **not** force Lyhna to violate its determinism or honesty invariants — the only
things in the way are the *required* envelope fields and the single-file structure (§4). That is what
makes the future "additive export adapter" in §7 viable: it could satisfy the required structure
(supply `owner.id`, inline `memories[]`, set the `schema` id) **without** ever adding a confidence score.
Today, the right posture is still an honest, clearly-labeled *projection* a PAM consumer can ingest
**without stripping the evidence verdict** — which is what `lyhna-pam/v0` is, with `evidence_status` on
every item and the `honesty_ceiling` block in the manifest.

## 6. What Lyhna already says about itself (and it's accurate)

The committed `pam/manifest.json` carries:

```json
"conformance": "PAM-shaped projection of a Lyhna witnessed-handoff/v1 receipt. Not yet validated against a formal published PAM schema."
```

This validation confirms that statement is **true and well-calibrated**. No change required.

## 7. Recommendation

1. **Keep "PAM-shaped" / `lyhna-pam/v0` on every surface.** Do not promote to "PAM-compatible." There is
   no single PAM standard to be compatible with, and Lyhna fails the closest concrete one on required
   fields by design.
2. **Keep the `conformance` string as-is** — it is accurate and now substantiated.
3. **(Optional, future, owner call — not done here):** if a specific carrier ever becomes the buyer's
   required PAM, an *additive export adapter* could emit a conformant view of that carrier (e.g. supply a
   real `owner.id`, inline `memories`, map types) **without** adding a confidence score — Lyhna would map
   `evidence_status` into the carrier's provenance, never into a fabricated confidence. Until a real
   carrier schema and a buyer need both exist, this is unwarranted surface area.
4. **Conceptual cousin worth tracking:** the arXiv *Portable Agent Memory* provenance protocol
   (Merkle-DAG, content-addressable, tamper-evident) is the most thesis-aligned effort. If it matures
   into a validatable schema, re-run this comparison — Lyhna's witness/provenance angle may map more
   naturally there than onto the user-memory-flavored Portable AI Memory format.

## 8. Honest limits of this validation

- This is a **field-level comparison against the published specs** as of 2026-06-16; we did **not**
  execute the published Portable AI Memory schema validator. That comparator *does* ship a machine-readable
  JSON Schema (`portable-ai-memory.schema.json`), so running Lyhna's `pam/` output through it with a JSON
  Schema validator is concrete, available future work. It is not needed to reach this verdict: Lyhna's
  output is a manifest + separate `memories.jsonl` rather than a single file with an inline `memories[]`,
  and lacks the required `schema`/`schema_version`/`owner.id`, so it fails that schema's required
  envelope/structure on inspection regardless of minor version drift.
- This lane validated the *shape/claim*, not a code change. No `src/pam.mjs` change is warranted.
