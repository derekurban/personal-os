import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { PersonalOSContext } from "./context.js";
import { readJson, writeJsonFile } from "./json.js";
import type { CaptureRecord, ManualUploadMeta, Registry, Tag } from "./types.js";

export const registryPathName = "registry.json";

export const seedRegistry: Registry = {
  core: {
    schema_version: 1,
    record_kind: "registry",
    registry_version: 1,
    updated_at: "2026-05-23T00:00:00.000Z"
  },
  tags: {
    media: [
      { value: "image", meaning: "Image-like payloads." },
      { value: "text", meaning: "Plain text payloads." },
      { value: "document", meaning: "Document payloads." },
      { value: "unknown", meaning: "Payload type could not be classified into a narrower approved media tag." }
    ],
    source: [{ value: "manual_upload", meaning: "Captured through the local CLI manual upload pipeline." }],
    workflow: [{ value: "inbox", meaning: "Newly captured item awaiting later review or derivation." }],
    sensitivity: [
      { value: "normal", meaning: "Default personal data." },
      { value: "private", meaning: "Private personal data." },
      { value: "sensitive", meaning: "Sensitive personal data." }
    ]
  },
  metadata_schemas: {
    "manual_upload.v1": {
      required: ["schema", "filename", "declared_mime_type", "detected_extension", "note", "source_type", "source_app"],
      optional: []
    }
  }
};

export function registryPath(context: PersonalOSContext): string {
  return path.join(context.governanceRoot, registryPathName);
}

/**
 * The registry is the current approved ontology view. The MVP keeps it as a
 * single JSON file so agents can inspect it easily; future proposal/decision
 * ledger work can rebuild this file from approved governance history.
 */
export async function ensureRegistry(context: PersonalOSContext): Promise<void> {
  await mkdir(context.governanceRoot, { recursive: true });
  try {
    await stat(registryPath(context));
  } catch {
    await writeJsonFile(registryPath(context), seedRegistry);
  }
}

export async function readRegistry(context: PersonalOSContext): Promise<Registry> {
  await ensureRegistry(context);
  const registry = await readJson<Registry>(registryPath(context));
  if (!registry.ok) {
    throw new Error(`Registry is missing or invalid: ${registry.error}`);
  }
  return registry.value;
}

export function allRegistryTags(registry: Registry): Set<string> {
  return new Set(
    Object.entries(registry.tags).flatMap(([namespace, entries]) =>
      entries.map((entry) => `${namespace}:${entry.value}`)
    )
  );
}

export function validateTags(registry: Registry, tags: string[]): string[] {
  const approvedTags = allRegistryTags(registry);
  return tags.filter((tag) => !approvedTags.has(tag));
}

export function assertValidTags(registry: Registry, tags: string[]): asserts tags is Tag[] {
  const invalid = validateTags(registry, tags);
  if (invalid.length > 0) {
    throw new Error(`Unapproved tag(s): ${invalid.join(", ")}`);
  }
}

export function isManualUploadMeta(value: unknown): value is ManualUploadMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const meta = value as Partial<Record<keyof ManualUploadMeta, unknown>>;
  return (
    meta.schema === "manual_upload.v1" &&
    typeof meta.filename === "string" &&
    (typeof meta.declared_mime_type === "string" || meta.declared_mime_type === null) &&
    (typeof meta.detected_extension === "string" || meta.detected_extension === null) &&
    (typeof meta.note === "string" || meta.note === null) &&
    meta.source_type === "manual_upload" &&
    meta.source_app === "personalos-cli"
  );
}

export function validateCaptureAgainstRegistry(registry: Registry, capture: CaptureRecord): string[] {
  const issues: string[] = [];
  const invalidTags = validateTags(registry, capture.tags);
  if (invalidTags.length > 0) {
    issues.push(`Unapproved tag(s): ${invalidTags.join(", ")}`);
  }

  if (!isManualUploadMeta(capture.meta)) {
    issues.push("Capture meta does not match manual_upload.v1.");
  }

  return issues;
}

export function registrySummary(registry: Registry): string {
  const tagLines = Object.entries(registry.tags)
    .map(([namespace, entries]) => `  ${namespace}: ${entries.map((entry) => entry.value).join(", ")}`)
    .join("\n");
  const schemaLines = Object.keys(registry.metadata_schemas)
    .map((schema) => `  ${schema}`)
    .join("\n");

  return `registry_version=${registry.core.registry_version}\ntags:\n${tagLines}\nmetadata_schemas:\n${schemaLines}`;
}
