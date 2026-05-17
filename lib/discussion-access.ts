import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureBatchSettings } from "@/lib/batch-settings";

const ACCESS_CODE_KEY = "discussion_access_code_hash";

function accessCodeSecret() {
  return (
    process.env.DISCUSSION_ACCESS_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "local-development-discussion-access"
  );
}

function normalizeCode(code: string) {
  return code.trim();
}

function hashDiscussionCode(code: string) {
  return createHash("sha256")
    .update(`${accessCodeSecret()}:${normalizeCode(code)}`)
    .digest("hex");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function ensureDiscussionAccessTables() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS user_discussion_access (
       user_id    TEXT PRIMARY KEY,
       code_hash  TEXT,
       granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY(user_id) REFERENCES app_users(id)
     )`
  );
  const columns = await db.execute("PRAGMA table_info(user_discussion_access)");
  const hasCodeHash = columns.rows.some((row) => row.name === "code_hash");
  if (!hasCodeHash) {
    await db.execute("ALTER TABLE user_discussion_access ADD COLUMN code_hash TEXT");
  }
}

async function getStoredAccessCodeHash() {
  await ensureBatchSettings();
  const result = await db.execute({
    sql: "SELECT value FROM batch_settings WHERE key = ? LIMIT 1",
    args: [ACCESS_CODE_KEY],
  });
  const value = result.rows[0]?.value;
  return typeof value === "string" && value ? value : "";
}

export async function isDiscussionAccessCodeConfigured() {
  return Boolean(await getStoredAccessCodeHash());
}

export async function setDiscussionAccessCode(code: string) {
  await ensureBatchSettings();
  const normalized = normalizeCode(code);
  const value = normalized ? hashDiscussionCode(normalized) : "";

  await db.execute({
    sql: `INSERT INTO batch_settings(key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at`,
    args: [ACCESS_CODE_KEY, value],
  });

  return Boolean(value);
}

export async function verifyDiscussionAccessCode(code: string) {
  const storedHash = await getStoredAccessCodeHash();
  const normalized = normalizeCode(code);
  if (!storedHash || !normalized) return false;
  return secureEqual(hashDiscussionCode(normalized), storedHash);
}

export async function grantDiscussionAccess(userId: string) {
  await ensureDiscussionAccessTables();
  const codeHash = await getStoredAccessCodeHash();
  await db.execute({
    sql: `INSERT INTO user_discussion_access(user_id, code_hash, granted_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            code_hash = excluded.code_hash,
            granted_at = excluded.granted_at`,
    args: [userId, codeHash],
  });
}

export async function getDiscussionAccessStatus(userId: string | null) {
  const storedHash = await getStoredAccessCodeHash();
  const configured = Boolean(storedHash);
  if (!userId) {
    return { configured, hasAccess: false, grantedAt: null };
  }

  await ensureDiscussionAccessTables();
  const result = await db.execute({
    sql: "SELECT code_hash, granted_at FROM user_discussion_access WHERE user_id = ? LIMIT 1",
    args: [userId],
  });
  const row = result.rows[0];
  const grantedAt = result.rows[0]?.granted_at;
  const codeHash = row?.code_hash;

  return {
    configured,
    hasAccess:
      configured &&
      typeof grantedAt === "string" &&
      Boolean(grantedAt) &&
      typeof codeHash === "string" &&
      codeHash === storedHash,
    grantedAt: typeof grantedAt === "string" ? grantedAt : null,
  };
}

export async function requireDiscussionAccessApi() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: unauthorized() };
  }

  const access = await getDiscussionAccessStatus(user.id);
  if (!access.hasAccess) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error:
            "종목 토론 조회 권한이 없습니다. 마이페이지에서 종목토론조회 코드를 입력하세요.",
        },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}
