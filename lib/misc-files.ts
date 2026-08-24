import { db } from "@/lib/db";

export const MAX_MISC_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface MiscFile {
  id: string;
  fileName: string;
  pathname: string;
  url: string | null;
  downloadUrl: string | null;
  contentType: string | null;
  sizeBytes: number;
  status: "pending" | "ready";
  createdAt: string | null;
  uploadedAt: string | null;
}

let miscFilesSchemaReady: Promise<void> | null = null;

export function isBlobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function rowToMiscFile(row: Record<string, unknown>): MiscFile {
  return {
    id: String(row.id),
    fileName: String(row.original_name || ""),
    pathname: String(row.pathname || ""),
    url: toStringOrNull(row.blob_url),
    downloadUrl: toStringOrNull(row.download_url),
    contentType: toStringOrNull(row.content_type),
    sizeBytes: toNumber(row.size_bytes),
    status: row.status === "ready" ? "ready" : "pending",
    createdAt: toStringOrNull(row.created_at),
    uploadedAt: toStringOrNull(row.uploaded_at),
  };
}

async function ensureMiscFilesSchemaUncached() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS misc_files (
       id            TEXT PRIMARY KEY,
       user_id       TEXT NOT NULL,
       original_name TEXT NOT NULL,
       pathname      TEXT NOT NULL UNIQUE,
       blob_url      TEXT,
       download_url  TEXT,
       content_type  TEXT,
       size_bytes    INTEGER NOT NULL DEFAULT 0,
       status        TEXT NOT NULL DEFAULT 'pending',
       created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       uploaded_at   TEXT,
       updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY(user_id) REFERENCES app_users(id)
     )`
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_misc_files_user_status ON misc_files(user_id, status, uploaded_at)"
  );
}

export async function ensureMiscFilesSchema() {
  miscFilesSchemaReady ??= ensureMiscFilesSchemaUncached();
  return miscFilesSchemaReady;
}

export function normalizeFileName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name.replace(/[\\/\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
}

function safePathFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_ .-]+|[_ .-]+$/g, "")
    .slice(0, 120);

  return cleaned || "attachment";
}

function safeUserFolder(userId: string) {
  return Buffer.from(userId).toString("base64url");
}

export async function createPendingMiscFile({
  userId,
  fileName,
  sizeBytes,
  contentType,
}: {
  userId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string | null;
}) {
  await ensureMiscFilesSchema();
  const id = `file_${globalThis.crypto.randomUUID()}`;
  const pathname = `misc-files/${safeUserFolder(userId)}/${id}-${safePathFileName(
    fileName
  )}`;

  await db.execute({
    sql: `INSERT INTO misc_files (
            id, user_id, original_name, pathname, content_type, size_bytes,
            status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, userId, fileName, pathname, contentType, sizeBytes],
  });

  return { id, pathname };
}

export async function listMiscFiles(userId: string) {
  await ensureMiscFilesSchema();
  const result = await db.execute({
    sql: `SELECT id, original_name, pathname, blob_url, download_url,
                 content_type, size_bytes, status, created_at, uploaded_at
          FROM misc_files
          WHERE user_id = ? AND status = 'ready'
          ORDER BY uploaded_at DESC, created_at DESC`,
    args: [userId],
  });

  return result.rows.map((row) => rowToMiscFile(row as Record<string, unknown>));
}

export async function getMiscFileForUser(userId: string, fileId: string) {
  await ensureMiscFilesSchema();
  const result = await db.execute({
    sql: `SELECT id, original_name, pathname, blob_url, download_url,
                 content_type, size_bytes, status, created_at, uploaded_at
          FROM misc_files
          WHERE user_id = ? AND id = ?
          LIMIT 1`,
    args: [userId, fileId],
  });

  const row = result.rows[0];
  return row ? rowToMiscFile(row as Record<string, unknown>) : null;
}

export async function completeMiscFileUpload({
  userId,
  fileId,
  url,
  downloadUrl,
  contentType,
  sizeBytes,
}: {
  userId: string;
  fileId: string;
  url: string;
  downloadUrl: string;
  contentType: string | null;
  sizeBytes: number;
}) {
  await ensureMiscFilesSchema();
  await db.execute({
    sql: `UPDATE misc_files
          SET blob_url = ?,
              download_url = ?,
              content_type = COALESCE(?, content_type),
              size_bytes = ?,
              status = 'ready',
              uploaded_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND id = ?`,
    args: [url, downloadUrl, contentType, sizeBytes, userId, fileId],
  });
}

export async function deleteMiscFileRecord(userId: string, fileId: string) {
  await ensureMiscFilesSchema();
  await db.execute({
    sql: "DELETE FROM misc_files WHERE user_id = ? AND id = ?",
    args: [userId, fileId],
  });
}
