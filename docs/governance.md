# Governance

PersonalOS is designed for a personal agent in an isolated personal environment.
Governance should stay small: it exists to keep capture useful without letting
agents expand the ontology or capture behavior unchecked.

## Principle

```text
Humans approve durable shape.
Agents operate within approved shape.
```

Agents can propose, compute, summarize, inspect, and create reversible outputs.
Humans approve changes that affect future capture, vocabulary, permissions, or
durable system behavior.

## Minimal Primitives

Governance is built from four primitives:

```text
Registry  current approved ontology and contracts
Proposal  requested change to the registry or durable behavior
Decision  human review outcome for a proposal
Ledger    append-only history of approved changes
```

The registry tells agents what is currently allowed. The ledger explains how it
became allowed. Proposals and decisions control change.

## Registry

The registry is the current approved state of the system. It should be easy for
agents to inspect and easy for a human to review.

The registry may include:

- tag namespaces and tag values
- metadata schemas
- source types
- pipeline ids and permissions
- reusable view definitions
- durable workflow definitions

The registry is a convenience view over approved governance history. If needed,
it should be possible to rebuild it from the ledger.

## Proposal

A proposal is a small requested change. Agents may draft proposals, but they do
not apply governed changes directly.

Examples:

- add tag `workflow:needs_review`
- add metadata schema `android.photo.v1`
- approve pipeline `gmail.attachment.capture.v1`
- deprecate tag `topic:misc`
- promote a one-off script into a reusable workflow

A proposal should answer:

```text
What changes?
Why is it useful?
What can it affect?
What examples show correct use?
```

Keep proposals small. A proposal that changes tags, metadata, and pipeline
behavior at the same time should usually be split unless the pieces only make
sense together.

## Decision

A decision is the human review outcome for a proposal.

Supported decisions:

```text
approved
rejected
needs_changes
```

A decision may include human notes, but it should not require a long review
document. The goal is a fast, explicit approval trail.

## Ledger

The ledger is the append-only history of approved changes.

A ledger entry should record:

- proposal id
- decision id
- approved change
- reviewer
- timestamp
- registry version before and after the change

The ledger is the durable governance history. The registry is the current
working view.

## Record Grammar

Durable records should use the same section names whenever possible:

```text
core  required system fields
refs  references to blobs, captures, derived records, or external objects
tags  typed, approved vocabulary for filtering, routing, and review
meta  typed factual details outside core orchestration
```

The core system depends on `core` and `refs`. These fields are strict and
required.

Tags and metadata should also be typed, but their types belong to approved
registries and pipeline contracts. This lets agents write lintable scripts while
keeping the core system small.

## What Requires Review

Human review is required for:

- new tag namespaces or tag values
- new metadata schemas that reusable pipelines depend on
- new ingestion pipelines
- new source integrations
- changes to core record structure
- changes to storage rules
- promoting one-off scripts into reusable workflows
- changes that affect future capture behavior

Agents may act without extra approval when they stay inside approved rules:

- create derived records
- run temporary views
- write one-off analysis scripts
- refresh rebuildable outputs
- audit storage and report problems
- draft proposals for human review

Agents should not silently add new ontology, new capture permissions, or new
durable workflows.

## Tags

Tags are the primary low-cardinality semantic handles in the system. They should
be used for filtering, sorting, routing, review, and workflow state.

A tag registry entry should include:

- namespace
- value
- short meaning
- examples of correct use
- examples of incorrect use when needed

Sensitivity can start as tags such as `sensitivity:private` or
`sensitivity:sensitive`. A heavier policy system should only be added if the
personal environment needs stricter enforcement later.

## Metadata

Metadata stores factual detail that is useful but not part of core
orchestration. Metadata should still be typed by the pipeline that writes it.

Examples include:

- filenames
- declared MIME types
- external ids
- account ids
- generator ids
- dimensions
- timestamps
- notes

If the system begins to depend on a metadata field for orchestration, that field
should be promoted into `core`, `refs`, or typed tags through review.

## Pipelines

An ingestion pipeline needs review before it writes durable captures. A pipeline
proposal should state:

- what source it reads from
- what blobs it stores
- what capture records it emits
- what tags it may apply
- what metadata keys it writes
- how it avoids duplicate captures
- how it can be disabled

After approval, the pipeline can run automatically within those limits.

## Ontology Management

The system should make the approved ontology easy to inspect.

Useful views:

- tags by namespace
- metadata schemas by pipeline or source
- approved pipelines and their permissions
- pending proposals
- recent ledger entries
- usage for a tag or metadata field

Useful actions:

- approve
- reject
- request changes
- deprecate
- merge
- show usage

The user should manage changes through proposals and decisions, not by editing
raw registry files in normal use.

## Reversibility

The more a change affects future capture or vocabulary, the more review it
needs. Reversible derived records, temporary views, and one-off scripts can be
agent-driven when they stay inside approved tags, metadata, and storage rules.
