import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJson<T>(filePath: string): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
