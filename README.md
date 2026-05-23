# PersonalOS

PersonalOS starts with a simple capture layer: preserve raw inputs first, then
derive memory, search, workflow, and interpretation layers later.

The goal is to keep memory flexible without making it shapeless. Raw captured
objects stay immutable. Meaning is added through reviewed tags, metadata,
derived records, and views.

## Operating Model

PersonalOS separates memory into a few durable concepts:

```text
Blob      raw bytes stored by SHA-256
Capture   append-only record of how and why bytes entered the system
Derived   interpretation, summary, transcription, transform, or analysis
View      rebuildable projection over captures and derived records
```

The blob is the source of truth for bytes. The capture is the source of truth
for the ingestion event. Derived records and views make the system useful, but
they do not replace the original capture.

## Record Grammar

PersonalOS records use a small shared grammar:

```text
core  required system fields
refs  references to blobs, captures, derived records, or external objects
tags  typed, approved vocabulary for filtering, routing, and review
meta  typed factual details that are useful but not part of core orchestration
```

The core system depends on `core` and `refs`. These fields should be strict,
required, and stable because they let the system identify records, connect
records, validate storage, and orchestrate work.

Tags and metadata should also be typed whenever possible, but they are typed at
the pipeline or registry layer. This keeps ingestion and retrieval scripts
lintable without forcing every captured domain into the core schema.

## Tags And Metadata

Tags carry low-cardinality operational meaning. They are used for filtering,
sorting, routing, review, and agent workflows.

Metadata carries factual detail. It is useful for search, provenance, display,
and debugging, but it should not become the primary organizing layer.

Good tags are predefined and reviewable:

```text
media:image
source:android
workflow:needs_review
sensitivity:private
```

High-cardinality values such as filenames, message ids, account ids, timestamps,
hashes, locations, and freeform notes belong in metadata.

## Governance

Agents can compute, summarize, draft, query, and create reversible projections.
Humans approve changes that alter the long-term shape of memory.

Human review is required for:

- new tag namespaces or tag values
- new ingestion pipelines
- changes to capture schema or storage policy
- source integrations and permissions
- retention, deletion, and sensitivity policy
- promoting one-off logic into reusable system behavior

Agents may perform without extra approval when scoped to existing policy:

- create derived records
- refresh or create temporary views
- run one-off analysis scripts
- propose tags, pipelines, policies, or view definitions
- audit consistency and report problems

The rule of thumb is:

```text
If it changes future capture, ontology, permissions, or durable policy, review it.
If it is reproducible, removable, and does not change the ontology, agents may do it.
```

See `docs/governance.md` for the approval model.

## Commands

Install dependencies:

```bash
pnpm install
```

Build the SDK/CLI:

```bash
pnpm build
```

Run during development:

```bash
pnpm cli -- doctor --home ./.dev-home
```

After linking or installing locally, use the `personalos` command:

```bash
personalos doctor --home D:\PersonalOS
```

Home resolution is:

```text
--home <path>
PERSONALOS_HOME
%USERPROFILE%\.personalos
```

Ensure the storage layout exists:

```bash
personalos init --home D:\PersonalOS
```

Ingest a file:

```bash
personalos ingest ./path/to/file.pdf --home D:\PersonalOS --source manual_upload --note "why this matters"
```

Check archive consistency:

```bash
personalos doctor --home D:\PersonalOS
personalos doctor --home D:\PersonalOS --deep
```

Repair missing blob metadata sidecars:

```bash
personalos repair --home D:\PersonalOS
```

Inspect the approved registry:

```bash
personalos registry status --home D:\PersonalOS
```

## Storage Contract

The archive keeps raw bytes separate from capture events:

```text
storage/sha256/   content-addressed blob store
storage/captures/ append-only capture event records
storage/derived/  derived artifacts and interpretations
storage/views/    rebuildable human-readable projections
storage/tmp/      temporary ingestion files
```

See `storage/README.md` for the detailed layout.

## Development Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```
