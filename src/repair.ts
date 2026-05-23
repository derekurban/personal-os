import { stat } from "node:fs/promises";
import path from "node:path";
import type { PersonalOSContext } from "./context.js";
import { contextFromArgs } from "./context.js";
import { writeJsonFile } from "./json.js";
import { detectMimeFromPath } from "./mime.js";
import { blobMetadataPath, createBlobMetadata, ensureStorageLayout, nowIso } from "./storage.js";
import { walkFiles } from "./walk.js";

const sha256Pattern = /^[a-f0-9]{64}$/;

export async function repairCommand(args: string[]): Promise<void> {
  const context = contextFromArgs(args);
  const repaired = await repairMissingMetadata(context);
  console.log(`home=${context.home}`);
  console.log(`repair complete: ${repaired} metadata sidecar(s) recreated`);
}

export async function repairMissingMetadata(context: PersonalOSContext): Promise<number> {
  await ensureStorageLayout(context);

  let repaired = 0;

  for await (const filePath of walkFiles(path.join(context.storageRoot, "sha256"))) {
    if (filePath.endsWith(".metadata.json") || path.basename(filePath) === ".gitkeep") {
      continue;
    }

    const hash = path.basename(filePath);
    if (!sha256Pattern.test(hash)) {
      continue;
    }

    const metadataPath = blobMetadataPath(context, hash);
    try {
      await stat(metadataPath);
      continue;
    } catch {
      const blobStat = await stat(filePath);
      const detected = detectMimeFromPath(filePath);
      const timestamp = nowIso();
      const metadata = createBlobMetadata({
        hash,
        sizeBytes: blobStat.size,
        detectedMimeType: detected.mimeType,
        detectedExtension: detected.extension,
        detectionSource: detected.source,
        createdAt: timestamp,
        verifiedAt: timestamp
      });

      await writeJsonFile(metadataPath, metadata);
      repaired += 1;
      console.log(`recreated metadata: ${metadataPath}`);
    }
  }

  return repaired;
}
