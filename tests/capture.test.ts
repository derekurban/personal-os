import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createContext } from "../src/context.js";
import { runDoctor, initDoctorLayout } from "../src/doctor.js";
import { ingestFile } from "../src/ingest.js";
import { readJson } from "../src/json.js";
import { readRegistry } from "../src/registry.js";
import type { CaptureRecord } from "../src/types.js";

async function tempHome(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "personalos-test-"));
}

test("init creates storage and governance layout", async () => {
  const context = createContext({ home: await tempHome() });
  await initDoctorLayout(context);

  await stat(path.join(context.storageRoot, "sha256"));
  await stat(path.join(context.storageRoot, "captures"));
  await stat(path.join(context.storageRoot, "derived"));
  await stat(path.join(context.storageRoot, "views", "by-date"));
  await stat(path.join(context.governanceRoot, "registry.json"));
});

test("manual ingest writes blob, sidecar metadata, and sectioned capture", async () => {
  const context = createContext({ home: await tempHome() });
  await initDoctorLayout(context);
  const source = path.join(context.home, "sample.txt");
  await writeFile(source, "hello memory\n", "utf8");

  const result = await ingestFile(context, [source, "--note", "test note", "--sensitivity", "private"]);

  await stat(result.blobPath);
  await stat(result.metadataPath);
  await stat(result.capturePath);

  const capture = await readJson<CaptureRecord>(result.capturePath);
  assert.equal(capture.ok, true);
  if (!capture.ok) {
    return;
  }

  assert.equal(capture.value.core.record_kind, "capture");
  assert.equal(capture.value.core.schema_version, 2);
  assert.equal(capture.value.refs.payload.ref, result.payloadRef);
  assert.deepEqual(capture.value.tags, ["media:text", "source:manual_upload", "workflow:inbox", "sensitivity:private"]);
  assert.equal(capture.value.meta.schema, "manual_upload.v1");
  assert.equal(capture.value.meta.note, "test note");
});

test("manual ingest rejects unapproved tags", async () => {
  const context = createContext({ home: await tempHome() });
  await initDoctorLayout(context);
  const source = path.join(context.home, "sample.txt");
  await writeFile(source, "hello memory\n", "utf8");

  await assert.rejects(
    ingestFile(context, [source, "--tag", "topic:unapproved"]),
    /Unapproved tag/
  );
});

test("doctor passes on initialized empty home and after valid ingest", async () => {
  const context = createContext({ home: await tempHome() });
  await initDoctorLayout(context);

  assert.deepEqual(await runDoctor(context, { deep: false }), []);

  const source = path.join(context.home, "sample.txt");
  await writeFile(source, "hello memory\n", "utf8");
  await ingestFile(context, [source]);

  assert.deepEqual(await runDoctor(context, { deep: false }), []);
  assert.deepEqual(await runDoctor(context, { deep: true }), []);
});

test("doctor reports registry mismatch for invalid capture tags", async () => {
  const context = createContext({ home: await tempHome() });
  await initDoctorLayout(context);
  const source = path.join(context.home, "sample.txt");
  await writeFile(source, "hello memory\n", "utf8");
  const result = await ingestFile(context, [source]);
  const raw = await readFile(result.capturePath, "utf8");
  const capture = JSON.parse(raw) as CaptureRecord;
  capture.tags.push("topic:invalid" as CaptureRecord["tags"][number]);
  await writeFile(result.capturePath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");

  const issues = await runDoctor(context, { deep: false });
  assert.equal(issues.some((issue) => issue.code === "CAPTURE_REGISTRY_MISMATCH"), true);
});

test("registry status can read seed registry", async () => {
  const context = createContext({ home: await tempHome() });
  await initDoctorLayout(context);

  const registry = await readRegistry(context);
  assert.equal(registry.core.registry_version, 1);
  assert.equal(registry.tags.media.some((entry) => entry.value === "text"), true);
  assert.ok(registry.metadata_schemas["manual_upload.v1"]);
});
