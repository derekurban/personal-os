import path from "node:path";

const mimeByExtension = new Map<string, string>([
  [".avif", "image/avif"],
  [".csv", "text/csv"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json"],
  [".m4a", "audio/mp4"],
  [".md", "text/markdown"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".txt", "text/plain"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".zip", "application/zip"]
]);

export function detectMimeFromPath(filePath: string): {
  mimeType: string;
  extension: string | null;
  source: "extension" | "unknown";
} {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = mimeByExtension.get(extension);

  if (!extension || !mimeType) {
    return {
      mimeType: "application/octet-stream",
      extension: extension || null,
      source: "unknown"
    };
  }

  return {
    mimeType,
    extension,
    source: "extension"
  };
}
