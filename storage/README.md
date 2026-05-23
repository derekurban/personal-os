# Storage Layout

This directory is the archival base layer for PersonalOS.

The core rule is:

```text
Blob bytes are stored by content hash.
Capture records describe how, when, and why something entered the system.
Derived records describe later interpretations or transformations.
Indexes and views are rebuildable conveniences, not source-of-truth data.
```

## Directories

```text
storage/
  sha256/
    <first-2>/<next-2>/<full-sha256>
    <first-2>/<next-2>/<full-sha256>.metadata.json
  captures/
    YYYY/MM/DD/<capture-id>.json
  derived/
    YYYY/MM/DD/<derived-id>.json
  index.sqlite
  tmp/
  views/
    by-date/
    by-source/

governance/
  registry.json
```

## SHA-256 Blob Storage

Raw blob payloads live under `storage/sha256`.

The canonical filename is the full SHA-256 hash of the original bytes. Do not add
file extensions to canonical blob files. MIME type, original filename, and source
belong in metadata.

Example:

```text
storage/sha256/f3/91/f391abc123...fullhash
```

## Blob Metadata

Blob metadata lives beside the blob as a sidecar file and describes objective
facts about the bytes. The blob itself has no extension. Its sidecar uses
`.metadata.json`.

Example:

```text
storage/sha256/f3/91/f391abc123...fullhash
storage/sha256/f3/91/f391abc123...fullhash.metadata.json
```

Example:

```json
{
  "payload_ref": "sha256:f391abc123...",
  "sha256": "f391abc123...",
  "size_bytes": 4829112,
  "detected_mime_type": "image/jpeg",
  "storage_ref": "sha256/f3/91/f391abc123...",
  "created_at": "2026-04-27T18:42:11-06:00"
}
```

Blob metadata should not describe why the object matters. The same blob can be
captured multiple times for different reasons.

## Capture Records

Capture records live under `storage/captures` and describe an event: how a
payload entered PersonalOS.

Capture records should follow the shared record grammar:

```text
core  required capture identity and timestamps
refs  payload references and other durable links
tags  approved vocabulary applied to this capture
meta  typed source facts and capture details
```

Example:

```json
{
  "core": {
    "schema_version": 1,
    "record_kind": "capture",
    "capture_id": "cap_01HWZK7Q8S4WZQ0Y5N8B3V9A2F",
    "captured_at": "2026-04-27T18:42:11-06:00",
    "ingested_at": "2026-04-27T18:42:11-06:00"
  },
  "refs": {
    "payload": {
      "kind": "blob",
      "ref": "sha256:f391abc123..."
    }
  },
  "tags": [
    "media:image",
    "source:manual_upload",
    "sensitivity:private"
  ],
  "meta": {
    "filename": "IMG_4921.jpeg",
    "declared_mime_type": "image/jpeg",
    "source_app": "personalos-cli",
    "source_account": null,
    "source_external_id": null,
    "note": "recipe photo from dinner"
  }
}
```

Capture records should be append-only. If classification, transcription,
summarization, or correction is needed, create a derived record instead of
rewriting the original capture event.

Tags should be added only through the reviewed ontology. Metadata should be
typed by the pipeline or registry that writes it. Use tags for low-cardinality
operational meaning such as source, media kind, workflow state, or sensitivity.
Use metadata for high-cardinality facts such as filenames, external ids,
timestamps, generator ids, and freeform notes.

The current manual upload pipeline writes `schema_version: 2` capture records.
Older flat capture examples are superseded by the `core` / `refs` / `tags` /
`meta` shape.

## Derived Records

Derived records live under `storage/derived` and describe generated or reviewed
interpretations over captures, blobs, or other derived records.

Examples include OCR, transcripts, summaries, embeddings, thumbnails,
classifications, and normalized versions of an original blob.

Derived records should preserve provenance:

```text
what inputs were used
what generated the result
when it was generated
what output was produced
```

If a derived result is wrong, create a correction or replacement record instead
of rewriting the original capture.

## Indexes

`storage/index.sqlite` is a rebuildable query accelerator, not the source of
truth. If it is deleted, it should be possible to recreate it from `sha256`,
`captures`, and `derived`.

## Views

`storage/views` is for human-readable projections such as by-date or by-source
links. These views are generated from metadata and can be deleted/rebuilt.

View output is not durable truth. A reusable view definition should be reviewed
before it becomes part of the system; temporary or one-off views can be created
by agents when they stay within approved tags, metadata, and policies.

## Temporary Files

Incoming payloads can be written to `tmp` first, hashed, checked, and then moved
into the content-addressed blob store. A quarantine folder can be added later if
ingestion starts accepting untrusted remote data and failed payloads need to be
preserved for inspection.
