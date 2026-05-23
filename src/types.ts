export type PayloadRef = `sha256:${string}`;

export type Tag =
  | "media:image"
  | "media:text"
  | "media:document"
  | "media:unknown"
  | "source:manual_upload"
  | "workflow:inbox"
  | "sensitivity:normal"
  | "sensitivity:private"
  | "sensitivity:sensitive";

export type BlobMetadata = {
  schema_version: 1;
  payload_ref: PayloadRef;
  sha256: string;
  size_bytes: number;
  storage_ref: string;
  detected_mime_type: string;
  detected_extension: string | null;
  detection_source: "extension" | "unknown";
  created_at: string;
  verified_at: string;
};

export type ManualUploadMeta = {
  schema: "manual_upload.v1";
  filename: string;
  declared_mime_type: string | null;
  detected_extension: string | null;
  note: string | null;
  source_type: "manual_upload";
  source_app: "personalos-cli";
};

export type CaptureRecord = {
  core: {
    schema_version: 2;
    record_kind: "capture";
    capture_id: string;
    captured_at: string;
    ingested_at: string;
  };
  refs: {
    payload: {
      kind: "blob";
      ref: PayloadRef;
    };
  };
  tags: Tag[];
  meta: ManualUploadMeta;
};

export type Registry = {
  core: {
    schema_version: 1;
    record_kind: "registry";
    registry_version: number;
    updated_at: string;
  };
  tags: Record<string, Array<{ value: string; meaning: string }>>;
  metadata_schemas: Record<string, { required: string[]; optional: string[] }>;
};

export type DoctorIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type IngestResult = {
  captureId: string;
  payloadRef: PayloadRef;
  blobPath: string;
  blobAlreadyExisted: boolean;
  metadataPath: string;
  capturePath: string;
};
