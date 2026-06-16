# PAM Schema Validation

> **Verdict: KEEP "PAM-shaped." Lyhna's export does NOT validate against any formal published PAM
> schema, and — by design — cannot fully conform without violating its own determinism and honesty
> invariants.** There is no single canonical "PAM" standard to be compatible with: the acronym maps to
> at least three unrelated specifications. Against the closest one (Portable AI Memory v1.0), Lyhna's
> projection shares the *concept* but differs in envelope identity, required fields, file layout, type
> vocabulary, and deliberately omits confidence scores and timestamps. The existing marketing wording
> ("PAM-shaped" / `lyhna-pam/v0`) and the in-artifact `conformance` string are accurate and should not
> change to "PAM-compatible."
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

| Aspect | Portable AI Memory v1.0 | Lyhna `lyhna-pam/v0` | Validates? |
| --- | --- | --- | --- |
| Envelope `schema` value | `"portable-ai-memory"` (required) | `"lyhna-pam/v0"` | ❌ wrong required value |
| `schema_version` | `"1.0"` (required) | *absent* (uses `pam_projection: "v0"`) | ❌ missing required field |
| `owner` / `owner.id` | **required** | *absent* (no owner concept) | ❌ missing required field |
| `memories` | inline array, **single file** | `memories_file: "memories.jsonl"` indirection (manifest + JSONL) | ❌ structural mismatch |
| Record `type` field | `type`, 11 user-memory types | `memory_type`, 5 cognitive types (episodic/semantic/procedural/working/identity) | ❌ field name + vocabulary mismatch (only `identity` overlaps) |
| `content_hash` | SHA-256 per record | *absent* on memory items | ❌ missing |
| `temporal.created_at` | required-ish timestamp | *absent* | ❌ missing (deliberate — see §5) |
| `confidence.initial` | 0.0–1.0 score | *absent* | ❌ missing (deliberate — see §5) |
| `provenance` | `{platform, extraction_method}` | `{source, lyhna_schema, evidence_status, handoff_resource}` | ❌ different shape |

**Result: Lyhna does not validate as Portable AI Memory v1.0.** It fails multiple *required* fields
(`schema` value, `schema_version`, `owner.id`) and the single-file structure, and uses a different memory
type vocabulary and record shape. It is a *projection inspired by* the same idea, not a conformant
instance — i.e., genuinely **PAM-shaped**.

## 5. Two gaps are principled, not fixable (and that is the point)

Two of the differences above are not oversights Lyhna could "fix" to gain conformance — closing them
would break Lyhna's own non-negotiable invariants:

- **No `confidence` score.** The honesty ceiling explicitly forbids treating *agent confidence as
  evidence* (it is in the artifact's own `honesty_ceiling.never_asserts`). A `confidence.initial: 0.92`
  on a witnessed memory would invite exactly the misread Lyhna exists to prevent. Lyhna carries
  `evidence_status` instead — provenance, not self-assessed confidence.
- **No timestamps (`export_date` / `temporal.created_at`).** The labeler/generator is deterministic by
  contract — **no clock** — so the same input is byte-identical output (the drift gates enforce this).
  Emitting wall-clock timestamps would break determinism. (A caller *may* pass a `timestamp` option, but
  the committed canonical artifact omits it on purpose.)

So even adopting Portable AI Memory v1.0 wholesale would force Lyhna to violate its determinism and
honesty invariants. The right posture is not conformance; it is an honest, clearly-labeled *projection*
that a PAM consumer can ingest **without stripping the evidence verdict** — which is what `lyhna-pam/v0`
is, with `evidence_status` on every item and the `honesty_ceiling` block in the manifest.

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

- Compared against the **published descriptions** of the candidate specs as of 2026-06-16, not against a
  pinned machine-readable JSON Schema file run through a validator (none of the candidates ships a single
  authoritative, stable `$schema` that Lyhna targets). The conclusion — *not conformant, keep
  "PAM-shaped"* — is robust to that: Lyhna fails required fields and the file structure of the closest
  comparator regardless of minor version drift.
- This lane validated the *shape/claim*, not a code change. No `src/pam.mjs` change is warranted.
