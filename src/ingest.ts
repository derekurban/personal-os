import path from "node:path";
import { stat } from "node:fs/promises";
import { getStringFlag, getStringFlags, parseArgs } from "./args.js";
import type { PersonalOSContext } from "./context.js";
import { contextFromArgs } from "./context.js";
import { writeJsonFile } from "./json.js";
import { detectMimeFromPath } from "./mime.js";
import { assertValidTags, readRegistry } from "./registry.js";
import {
  blobMetadataPath,
  capturePath,
  createBlobMetadata,
  createCaptureId,
  createCaptureRecord,
  hashFileToTemp,
  nowIso,
  storeTempBlob
} from "./storage.js";
import type { IngestResult, ManualUploadMeta, Tag } from "./types.js";

export async function ingestCommand(args: string[]): Promise<void> {
  const context = contextFromArgs(args);
  const result = await ingestFile(context, args);

  console.log(`home=${context.home}`);
  console.log(`capture_id=${result.captureId}`);
  console.log(`payload_ref=${result.payloadRef}`);
  console.log(`blob=${result.blobPath}`);
  console.log(`blob_already_existed=${result.blobAlreadyExisted}`);
  console.log(`metadata=${result.metadataPath}`);
  console.log(`capture=${result.capturePath}`);
}

export async function ingestFile(context: PersonalOSContext, args: string[]): Promise<IngestResult> {
  const parsed = parseArgs(args);
  const sourcePath = parsed.positional[0];

  if (!sourcePath) {
    throw new Error(
      "Usage: personalos ingest <file> [--home path] [--source manual_upload] [--note text] [--sensitivity normal|private|sensitive] [--tag tag]"
    );
  }

  const sourceType = getStringFlag(parsed.flags, "source") ?? "manual_upload";
  if (sourceType !== "manual_upload") {
    throw new Error("Only --source manual_upload is approved in the MVP registry.");
  }

  const absoluteSourcePath = path.resolve(sourcePath);
  const sourceStat = await stat(absoluteSourcePath);
  if (!sourceStat.isFile()) {
    throw new Error(`Ingest source is not a file: ${absoluteSourcePath}`);
  }

  const capturedAt = nowIso();
  const ingestedAt = capturedAt;
  const note = getStringFlag(parsed.flags, "note");
  const sensitivity = getStringFlag(parsed.flags, "sensitivity") ?? "normal";

  if (!["normal", "private", "sensitive"].includes(sensitivity)) {
    throw new Error("--sensitivity must be one of: normal, private, sensitive");
  }

  const mime = detectMimeFromPath(absoluteSourcePath);
  const registry = await readRegistry(context);
  const tags = [
    mediaTagForMime(mime.mimeType),
    "source:manual_upload",
    "workflow:inbox",
    `sensitivity:${sensitivity}`,
    ...getStringFlags(parsed.flags, "tag")
  ];
  assertValidTags(registry, tags);

  const hashed = await hashFileToTemp(context, absoluteSourcePath);
  const stored = await storeTempBlob(context, hashed.tempPath, hashed.hash);
  const metadata = createBlobMetadata({
    hash: hashed.hash,
    sizeBytes: hashed.sizeBytes,
    detectedMimeType: mime.mimeType,
    detectedExtension: mime.extension,
    detectionSource: mime.source,
    createdAt: capturedAt,
    verifiedAt: ingestedAt
  });

  await writeJsonFile(blobMetadataPath(context, hashed.hash), metadata);

  const meta: ManualUploadMeta = {
    schema: "manual_upload.v1",
    filename: path.basename(absoluteSourcePath),
    declared_mime_type: mime.mimeType,
    detected_extension: mime.extension,
    note,
    source_type: "manual_upload",
    source_app: "personalos-cli"
  };

  const captureId = createCaptureId(new Date(capturedAt));
  const capture = createCaptureRecord({
    captureId,
    capturedAt,
    ingestedAt,
    hash: hashed.hash,
    tags: tags as Tag[],
    meta
  });

  const captureFile = capturePath(context, capturedAt, captureId);
  await writeJsonFile(captureFile, capture);

  return {
    captureId,
    payloadRef: `sha256:${hashed.hash}`,
    blobPath: stored.storagePath,
    blobAlreadyExisted: stored.alreadyExisted,
    metadataPath: blobMetadataPath(context, hashed.hash),
    capturePath: captureFile
  };
}

function mediaTagForMime(mimeType: string): Tag {
  if (mimeType.startsWith("image/")) {
    return "media:image";
  }

  if (mimeType === "text/plain") {
    return "media:text";
  }

  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "media:document";
  }

  return "media:unknown";
}
