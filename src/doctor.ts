import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getBooleanFlag, parseArgs } from "./args.js";
import type { PersonalOSContext } from "./context.js";
import { contextFromArgs } from "./context.js";
import { readJson } from "./json.js";
import { ensureRegistry, readRegistry, validateCaptureAgainstRegistry } from "./registry.js";
import {
  blobMetadataPath,
  ensureStorageLayout,
  requiredStorageDirectories,
  sha256Path
} from "./storage.js";
import type { BlobMetadata, CaptureRecord, DoctorIssue } from "./types.js";
import { walkFiles } from "./walk.js";

const sha256Pattern = /^[a-f0-9]{64}$/;

export async function doctorCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const context = contextFromArgs(args);
  const deep = getBooleanFlag(parsed.flags, "deep");
  const issues = await runDoctor(context, { deep });

  if (issues.length === 0) {
    console.log(`home=${context.home}`);
    console.log(deep ? "doctor passed with deep hash verification" : "doctor passed");
    return;
  }

  for (const issue of issues) {
    const location = issue.path ? ` ${issue.path}` : "";
    console.log(`${issue.severity.toUpperCase()} ${issue.code}${location} - ${issue.message}`);
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

/**
 * Doctor validates both archive mechanics and the approved capture grammar. It
 * intentionally treats views and indexes as rebuildable; raw blobs, blob
 * sidecars, captures, and registry-backed tags are the first MVP invariants.
 */
export async function runDoctor(context: PersonalOSContext, options: { deep: boolean }): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];

  for (const directory of requiredStorageDirectories) {
    const directoryPath = path.join(context.storageRoot, directory);
    try {
      const directoryStat = await stat(directoryPath);
      if (!directoryStat.isDirectory()) {
        issues.push({
          severity: "error",
          code: "LAYOUT_NOT_DIRECTORY",
          path: directoryPath,
          message: "Required storage path exists but is not a directory."
        });
      }
    } catch {
      issues.push({
        severity: "error",
        code: "LAYOUT_MISSING_DIRECTORY",
        path: directoryPath,
        message: "Required storage directory is missing."
      });
    }
  }

  let registry = null as Awaited<ReturnType<typeof readRegistry>> | null;
  try {
    registry = await readRegistry(context);
  } catch (error) {
    issues.push({
      severity: "error",
      code: "REGISTRY_MISSING_OR_INVALID",
      path: path.join(context.governanceRoot, "registry.json"),
      message: error instanceof Error ? error.message : String(error)
    });
  }

  const hashes = new Set<string>();

  for await (const filePath of walkFiles(path.join(context.storageRoot, "sha256"))) {
    if (filePath.endsWith(".metadata.json") || path.basename(filePath) === ".gitkeep") {
      continue;
    }

    const hash = path.basename(filePath);
    if (!sha256Pattern.test(hash)) {
      issues.push({
        severity: "error",
        code: "BLOB_INVALID_NAME",
        path: filePath,
        message: "Blob filename must be a lowercase 64-character SHA-256 hash."
      });
      continue;
    }

    hashes.add(hash);

    const expectedPath = sha256Path(context, hash);
    if (path.resolve(filePath) !== path.resolve(expectedPath)) {
      issues.push({
        severity: "error",
        code: "BLOB_WRONG_PATH",
        path: filePath,
        message: `Blob should be stored at ${expectedPath}.`
      });
    }

    const metadata = await readJson<BlobMetadata>(blobMetadataPath(context, hash));
    if (!metadata.ok) {
      issues.push({
        severity: "error",
        code: "BLOB_METADATA_MISSING_OR_INVALID",
        path: blobMetadataPath(context, hash),
        message: metadata.error
      });
    } else {
      const blobStat = await stat(filePath);
      if (metadata.value.sha256 !== hash || metadata.value.payload_ref !== `sha256:${hash}`) {
        issues.push({
          severity: "error",
          code: "BLOB_METADATA_HASH_MISMATCH",
          path: blobMetadataPath(context, hash),
          message: "Metadata hash fields do not match the blob filename."
        });
      }

      if (metadata.value.size_bytes !== blobStat.size) {
        issues.push({
          severity: "error",
          code: "BLOB_METADATA_SIZE_MISMATCH",
          path: blobMetadataPath(context, hash),
          message: `Metadata size ${metadata.value.size_bytes} does not match actual size ${blobStat.size}.`
        });
      }
    }

    if (options.deep) {
      const actualHash = await hashFile(filePath);
      if (actualHash !== hash) {
        issues.push({
          severity: "error",
          code: "BLOB_CONTENT_HASH_MISMATCH",
          path: filePath,
          message: `Actual SHA-256 is ${actualHash}.`
        });
      }
    }
  }

  for await (const filePath of walkFiles(path.join(context.storageRoot, "captures"))) {
    if (!filePath.endsWith(".json") || path.basename(filePath) === ".gitkeep") {
      continue;
    }

    const capture = await readJson<CaptureRecord>(filePath);
    if (!capture.ok) {
      issues.push({
        severity: "error",
        code: "CAPTURE_INVALID_JSON",
        path: filePath,
        message: capture.error
      });
      continue;
    }

    if (capture.value.core?.record_kind !== "capture" || capture.value.core?.schema_version !== 2) {
      issues.push({
        severity: "error",
        code: "CAPTURE_INVALID_CORE",
        path: filePath,
        message: "Capture core must use record_kind=capture and schema_version=2."
      });
      continue;
    }

    const payloadRef = capture.value.refs?.payload?.ref;
    const hash = payloadRef?.startsWith("sha256:") ? payloadRef.slice("sha256:".length) : null;
    if (!hash || !sha256Pattern.test(hash)) {
      issues.push({
        severity: "error",
        code: "CAPTURE_INVALID_PAYLOAD_REF",
        path: filePath,
        message: "Capture payload ref must be sha256:<64 lowercase hex characters>."
      });
      continue;
    }

    if (registry) {
      for (const message of validateCaptureAgainstRegistry(registry, capture.value)) {
        issues.push({
          severity: "error",
          code: "CAPTURE_REGISTRY_MISMATCH",
          path: filePath,
          message
        });
      }
    }

    if (!hashes.has(hash)) {
      try {
        await stat(sha256Path(context, hash));
      } catch {
        issues.push({
          severity: "error",
          code: "CAPTURE_MISSING_BLOB",
          path: filePath,
          message: `Capture references missing payload sha256:${hash}.`
        });
      }
    }
  }

  return issues;
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function initDoctorLayout(context: PersonalOSContext): Promise<void> {
  await ensureStorageLayout(context);
  await ensureRegistry(context);
}
