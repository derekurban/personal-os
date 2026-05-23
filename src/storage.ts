import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { PersonalOSContext } from "./context.js";
import type { BlobMetadata, CaptureRecord, ManualUploadMeta, Tag } from "./types.js";

export const requiredStorageDirectories = [
  "sha256",
  "captures",
  "derived",
  "tmp",
  path.join("views", "by-date"),
  path.join("views", "by-source")
] as const;

export function nowIso(): string {
  return new Date().toISOString();
}

export function sha256Path(context: PersonalOSContext, hash: string): string {
  return path.join(context.storageRoot, "sha256", hash.slice(0, 2), hash.slice(2, 4), hash);
}

export function sha256StorageRef(hash: string): string {
  return path.posix.join("sha256", hash.slice(0, 2), hash.slice(2, 4), hash);
}

export function blobMetadataPath(context: PersonalOSContext, hash: string): string {
  return `${sha256Path(context, hash)}.metadata.json`;
}

export function capturePath(context: PersonalOSContext, capturedAt: string, captureId: string): string {
  const date = new Date(capturedAt);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return path.join(context.storageRoot, "captures", year, month, day, `${captureId}.json`);
}

/**
 * Layout creation is deliberately small and mechanical. It creates the durable
 * archive folders, but it does not decide what the user should capture or which
 * ontology should exist beyond the seed registry handled by governance code.
 */
export async function ensureStorageLayout(context: PersonalOSContext): Promise<void> {
  await Promise.all(
    requiredStorageDirectories.map((directory) => mkdir(path.join(context.storageRoot, directory), { recursive: true }))
  );
}

export async function hashFileToTemp(
  context: PersonalOSContext,
  sourcePath: string
): Promise<{ hash: string; sizeBytes: number; tempPath: string }> {
  await ensureStorageLayout(context);

  const tempPath = path.join(context.storageRoot, "tmp", `${Date.now()}-${randomBytes(8).toString("hex")}.part`);
  const hash = createHash("sha256");
  let sizeBytes = 0;

  const hashThrough = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      sizeBytes += chunk.byteLength;
      callback(null, chunk);
    }
  });

  await pipeline(createReadStream(sourcePath), hashThrough, createWriteStream(tempPath));

  return {
    hash: hash.digest("hex"),
    sizeBytes,
    tempPath
  };
}

/**
 * Blobs are immutable substrate. If bytes change because of compression,
 * redaction, or normalization, that is a new blob with a new hash rather than a
 * mutation of the existing content-addressed object.
 */
export async function storeTempBlob(
  context: PersonalOSContext,
  tempPath: string,
  hash: string
): Promise<{ storagePath: string; alreadyExisted: boolean }> {
  const storagePath = sha256Path(context, hash);
  await mkdir(path.dirname(storagePath), { recursive: true });

  try {
    await stat(storagePath);
    await rm(tempPath, { force: true });
    return { storagePath, alreadyExisted: true };
  } catch {
    await rename(tempPath, storagePath);
    return { storagePath, alreadyExisted: false };
  }
}

export function createCaptureId(date = new Date()): string {
  const timestamp = date.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
  return `cap_${timestamp}_${randomBytes(6).toString("hex")}`;
}

export function createBlobMetadata(input: {
  hash: string;
  sizeBytes: number;
  detectedMimeType: string;
  detectedExtension: string | null;
  detectionSource: "extension" | "unknown";
  createdAt: string;
  verifiedAt: string;
}): BlobMetadata {
  return {
    schema_version: 1,
    payload_ref: `sha256:${input.hash}`,
    sha256: input.hash,
    size_bytes: input.sizeBytes,
    storage_ref: sha256StorageRef(input.hash),
    detected_mime_type: input.detectedMimeType,
    detected_extension: input.detectedExtension,
    detection_source: input.detectionSource,
    created_at: input.createdAt,
    verified_at: input.verifiedAt
  };
}

/**
 * Captures are sectioned so agents can see which data is system substrate
 * (`core`/`refs`) and which data is approved vocabulary or pipeline-level facts
 * (`tags`/`meta`). This is the code-level expression of the governance docs.
 */
export function createCaptureRecord(input: {
  captureId: string;
  capturedAt: string;
  ingestedAt: string;
  hash: string;
  tags: Tag[];
  meta: ManualUploadMeta;
}): CaptureRecord {
  return {
    core: {
      schema_version: 2,
      record_kind: "capture",
      capture_id: input.captureId,
      captured_at: input.capturedAt,
      ingested_at: input.ingestedAt
    },
    refs: {
      payload: {
        kind: "blob",
        ref: `sha256:${input.hash}`
      }
    },
    tags: input.tags,
    meta: input.meta
  };
}
