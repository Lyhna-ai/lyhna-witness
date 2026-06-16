# PAM Schema Validation

> **Verdict: KEEP "PAM-shaped." Lyhna's export does NOT validate against the published Portable AI Memory
> v1.0 JSON Schema — confirmed by running the actual schema through a validator (ajv, JSON Schema draft
> 2020-12): INVALID, 239 errors.** The failures are required-field and value failures, at both the
> envelope and the per-record level. There is also no single canonical "PAM" standard to be compatible
> with — the acronym maps to at least three unrelated specs. The existing marketing wording
> ("PAM-shaped" / `lyhna-pam/v0`) and the in-artifact `conformance` string are accurate and should **not**
> change to "PAM-compatible."
>
> _Validated 2026-06-16. Schema: `https://schemas.portable-ai-memory.org/v1.0/memory-store.schema.json`
> (retrieved from `portable-ai-memory.org/schemas/portable-ai-memory.schema.json`). Lyhna PAM:
> `lyhna-pam/v0` (`src/pam.mjs`, `examples/live-loop/pam/`)._

---

## 1. Objective

Determine whether Lyhna's current PAM export (`pam/manifest.json` + `pam/memories.jsonl`) can honestly be
called **PAM-compatible**, by comparing it to the current best available PAM/schema reference. If it
validates, document the version and why. If not, keep "PAM-shaped" and list the exact gaps.

## 2. The PAM landscape — there is no single standard

"PAM" is an overloaded acronym with no single owning body:

| Name | What it actually is | Format | Relevance |
| --- | --- | --- | --- |
| **Portable AI Memory** (`portable-ai-memory.org`) | A JSON interchange format for AI memories ("vCard for AI memories"); ships a JSON Schema | Single JSON file, `schema_version` "1.0" | **Closest concrete schema** — used as the comparator below and validated against. |
| **Portable Agent Memory** (arXiv 2605.11032) | Research protocol: provenance-verified transfer, content-addressable entries on a Merkle-DAG | JSON-first + CBOR; Python SDK | Closest in *spirit* (provenance/tamper-evidence) but a research protocol, not a locked schema. |
| **Agent Memory Protocol (AMP)** | Markdown-first, graph-native, directory-portable | Markdown + directory | Different surface; not a JSON record schema. |
| **Portable Agent Manifest (PAM)** (jsonagents.org) | A *capability manifest* describing an agent's tools/governance — **not memory** | JSON Schema 2020-12 | Not applicable: different meaning of "PAM". |

**Consequence:** "PAM-compatible" is not a single verifiable claim — there is no one "PAM" to be
compatible *with*. This alone justifies keeping the hedged "PAM-shaped" wording, independent of the
field-level result below.

## 3. Comparator and how it was validated

**Comparator:** Portable AI Memory v1.0 — JSON Schema, draft 2020-12,
`$id: https://schemas.portable-ai-memory.org/v1.0/memory-store.schema.json`. Its `required` arrays
(read directly from the schema):

- **Envelope (root) required:** `schema`, `schema_version`, `owner`, `memories`.
  - `schema` is a `const` `"portable-ai-memory"`. `owner` requires `owner.id`.
- **`MemoryObject` (each item in `memories[]`) required:** `id`, `type`, `content`, `content_hash`,
  `temporal`, `provenance`.
  - `temporal` requires `created_at`; `provenance` requires `platform`; `type: "custom"` also requires
    `custom_type`.
  - **`confidence` is OPTIONAL** (a `ConfidenceBlock` exists but is not in `MemoryObject.required`).

**How validated:** built the most charitable single-file candidate from Lyhna's output —
`examples/live-loop/pam/manifest.json` with `memories.jsonl` inlined as the `memories` array — and ran it
through **ajv 8 (draft 2020-12, `ajv-formats`)** against the schema above.

## 4. Result — INVALID (239 errors)

The validator returned `VALID: false` with 239 errors. The distinct, representative failures:

**Envelope:**
- `/schema` — `const` failure: must equal `"portable-ai-memory"` (Lyhna emits `"lyhna-pam/v0"`).
- root — missing required `schema_version`.
- root — missing required `owner` (so `owner.id` is absent).

**Every memory record** (`/memories/N`, for all N):
- missing required `type` (Lyhna uses `memory_type`, a different field name + a 5-type cognitive
  vocabulary vs. the spec's 11 user-memory types).
- missing required `content_hash`.
- missing required `temporal` (and therefore `temporal.created_at`).
- missing required `provenance` (Lyhna carries `source` / `lyhna_schema` / `evidence_status` instead of a
  `provenance` block with `platform`).
- (`custom_type` also flagged, a downstream consequence of the missing `type`.)

**`additionalProperties: false` (root, `MemoryObject`, and the sub-blocks) rejects Lyhna's own fields.**
The schema is closed: the root, each `MemoryObject`, and `ProvenanceBlock`/`TemporalBlock`/`Owner` set
`additionalProperties: false` (only `MetadataBlock` allows extras, and `MemoryObject` has a `metadata`
slot). So Lyhna-specific fields are actively rejected — at root: `pam_projection`, `conformance`,
`source`, `lyhna_schema`, `name`, `objective`, `safe_to_continue`, `summary`, `honesty_ceiling`,
`memory_counts`, … ; per record: `memory_type`, `evidence_status`, `claimed`, `witnessed`, `source`, … .

**Error taxonomy of the 239:** `required` 119 · `additionalProperties` 105 · `if`/conditional 13 ·
`const` 1 (`/schema`) · `type` 1.

**Not flagged:** `confidence` — confirming it is genuinely optional. Lyhna omitting it is **not** why it
fails.

**Result: Lyhna does not validate as Portable AI Memory v1.0** — it fails required fields, a `const`
value, **and** the closed-object `additionalProperties` constraint at both the envelope and record levels.
It is a *projection inspired by* the same idea, not a conformant instance — i.e., genuinely **PAM-shaped**.

## 5. Which gaps conflict with Lyhna's invariants, and which don't

Now that the required set is known precisely, the gaps split cleanly. **Note this is a *remapping*, not an
augmentation:** because the schema is closed (`additionalProperties: false`), an adapter cannot just add
fields to the existing Lyhna document — it must emit a **new canonical PAM document** that drops or relocates
every Lyhna-specific field into the one allowed container (`metadata`, the only block with
`additionalProperties: true`) and carries only schema-defined fields elsewhere.

- **No conflict — mechanically derivable (an adapter could compute these deterministically):** `schema`
  value, `schema_version`, `owner.id`, an inline single-file `memories[]`, `content_hash` (a deterministic
  SHA-256 of normalized content), `provenance.platform` (map Lyhna's witnessed origin), and `type` (map
  the 5 cognitive types onto the spec's vocabulary, or use `type: "custom"` + `custom_type`). Lyhna's
  own signal — `evidence_status`, `claimed`/`witnessed`, `memory_type`, the `honesty_ceiling` block —
  would move into `metadata` (or be dropped). None of this touches the honesty ceiling or determinism.
- **`temporal.created_at` is REQUIRED and *does* touch determinism.** Lyhna's generator is deterministic
  by contract (no clock), so it will not mint a wall-clock timestamp. There is also **no current knob for
  a per-record `created_at`**: the CLI exposes only `--gate/--okf/--pam` and never forwards a timestamp,
  and the renderer API's optional `timestamp` (`renderPamBundle`/`renderOkfBundle`) is a single
  **manifest-level** field, not a per-memory `temporal.created_at`. Conformance is still achievable, but
  only by adding per-record **caller-supplied / source-derived** timestamps (e.g. from the witnessed
  turn), never a live clock — new work, not an existing option. A real required field with a real
  constraint: not a free win, but not a hard blocker either.
- **`confidence` is OPTIONAL — the one place principle and conformance fully align.** The honesty ceiling
  forbids treating agent confidence as evidence (`honesty_ceiling.never_asserts`), and the schema does not
  require it, so Lyhna omits it at **zero conformance cost**, carrying `evidence_status` (provenance) in
  its place.

Net: full conformance is a real, non-trivial build — a **remapping** that emits a new closed-schema
document (every required envelope + record field present, every Lyhna-specific field relocated to
`metadata` or dropped), with one genuine determinism constraint (`created_at` must be supplied, not
clocked). It would **not** require fabricating a confidence score. Today the honest posture is a
clearly-labeled *projection* a PAM consumer can ingest **without stripping the evidence verdict** — which
is what `lyhna-pam/v0` is.

## 6. What Lyhna already says about itself (and it's accurate)

The committed `pam/manifest.json` carries:

```json
"conformance": "PAM-shaped projection of a Lyhna witnessed-handoff/v1 receipt. Not yet validated against a formal published PAM schema."
```

This validation makes that statement concrete: it is now *validated against* the published schema, and
the result is non-conformant — so "PAM-shaped … not [conformant]" remains exactly right. (If anything, the
string could be updated to "validated against Portable AI Memory v1.0: non-conformant; PAM-shaped
projection," but that is an optional precision tweak, not a correction.)

## 7. Recommendation

1. **Keep "PAM-shaped" / `lyhna-pam/v0` on every surface.** Do not promote to "PAM-compatible." The
   published v1.0 schema rejects the current output (239 errors), and there is no single canonical PAM.
2. **Keep the `conformance` string** (optionally tighten it per §6).
3. **(Optional, future, owner call — not done here) A Portable-AI-Memory export adapter — a *remapping*,
   not an add-on.** Because the schema is closed (`additionalProperties: false`), the adapter must emit a
   **new canonical PAM document**, not augment the existing one. Scope, now precise: set
   `schema: "portable-ai-memory"` + `schema_version: "1.0"`; supply `owner.id`; inline `memories[]` in one
   file; per record provide `type` (mapped or `custom`), `content_hash` (deterministic SHA-256),
   `provenance.platform`, and a per-record `temporal.created_at` (from a supplied/source timestamp, never a
   clock — new work: there is no current per-record timestamp input, only an optional manifest-level
   `timestamp` on the renderer API, not exposed by the CLI); and **relocate every Lyhna-specific field**
   (`evidence_status`, `claimed`/`witnessed`, `memory_type`, `honesty_ceiling`, …) into the schema's one
   open container, `metadata` (or drop it) — since closed objects reject any field not in the schema. It
   would **never** add a fabricated `confidence`. Warranted only when a buyer actually requires this
   carrier.
4. **Conceptual cousin to track:** the arXiv *Portable Agent Memory* provenance protocol (Merkle-DAG,
   content-addressable, tamper-evident) is the most thesis-aligned effort; if it matures into a
   validatable schema, re-run this comparison — Lyhna's witness/provenance angle may map more naturally
   there than onto the user-memory-flavored Portable AI Memory format.

## 8. How to reproduce / honest limits

- **Reproduce:** download the schema from `https://portable-ai-memory.org/schemas/portable-ai-memory.schema.json`,
  build a candidate by inlining `examples/live-loop/pam/memories.jsonl` into `pam/manifest.json` as
  `memories`, and validate with ajv (draft 2020-12) — it returns `VALID: false` with the failures in §4.
  (ajv is **not** added to the witness repo, which is zero-dependency by design; the validation was run in
  a throwaway environment, the same posture as the LANE 1 driver.)
- **Limit:** validated against Portable AI Memory **v1.0** as published on 2026-06-16; a future spec
  version could change the required set. The verdict (non-conformant; keep "PAM-shaped") is robust — the
  envelope `const`/required failures alone are decisive regardless of record-level drift.
- This lane validated the *shape/claim*, not a code change. No `src/pam.mjs` change is warranted.
