import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { ensureBatchSettings } from "@/lib/batch-settings";

const ACCESS_CODE_KEY = "discussion_access_code_hash";
let discussionAccessTablesReady: Promise<void> | null = null;

export interface DiscussionAccessCodeSummary {
  id: number;
  label: string;
  durationDays: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  activeGrantCount: number;
}

interface VerifiedDiscussionCode {
  id: number;
  codeHash: string;
  durationDays: number;
}

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

async function ensureDiscussionAccessTablesUncached() {
  await ensureBatchSettings();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS discussion_access_codes (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       label         TEXT NOT NULL,
       code_hash     TEXT NOT NULL UNIQUE,
       duration_days INTEGER NOT NULL,
       active        INTEGER DEFAULT 1,
       created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
       updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS user_discussion_access (
       user_id    TEXT PRIMARY KEY,
       code_id    INTEGER,
       code_hash  TEXT,
       granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
       expires_at TEXT,
       FOREIGN KEY(user_id) REFERENCES app_users(id)
     )`
  );
  const columns = await db.execute("PRAGMA table_info(user_discussion_access)");
  const hasCodeId = columns.rows.some((row) => row.name === "code_id");
  const hasCodeHash = columns.rows.some((row) => row.name === "code_hash");
  const hasExpiresAt = columns.rows.some((row) => row.name === "expires_at");
  if (!hasCodeId) {
    await db.execute("ALTER TABLE user_discussion_access ADD COLUMN code_id INTEGER");
  }
  if (!hasCodeHash) {
    await db.execute("ALTER TABLE user_discussion_access ADD COLUMN code_hash TEXT");
  }
  if (!hasExpiresAt) {
    await db.execute("ALTER TABLE user_discussion_access ADD COLUMN expires_at TEXT");
  }
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_discussion_access_codes_active ON discussion_access_codes(active)"
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_user_discussion_access_expires ON user_discussion_access(expires_at)"
  );
  await migrateLegacyAccessCode();
}

export async function ensureDiscussionAccessTables() {
  discussionAccessTablesReady ??= ensureDiscussionAccessTablesUncached();
  return discussionAccessTablesReady;
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

async function migrateLegacyAccessCode() {
  const legacyHash = await getStoredAccessCodeHash();
  if (!legacyHash) return;

  await db.execute({
    sql: `INSERT OR IGNORE INTO discussion_access_codes
          (label, code_hash, duration_days, active, created_at, updated_at)
          VALUES ('기존 코드', ?, 365, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [legacyHash],
  });
}

export async function isDiscussionAccessCodeConfigured() {
  await ensureDiscussionAccessTables();
  const result = await db.execute(
    "SELECT COUNT(*) AS count FROM discussion_access_codes WHERE active = 1"
  );
  return Number(result.rows[0]?.count || 0) > 0;
}

export async function listDiscussionAccessCodes(): Promise<
  DiscussionAccessCodeSummary[]
> {
  await ensureDiscussionAccessTables();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `SELECT
            c.id,
            c.label,
            c.duration_days,
            c.active,
            c.created_at,
            c.updated_at,
            COUNT(a.user_id) AS active_grant_count
          FROM discussion_access_codes c
          LEFT JOIN user_discussion_access a
            ON a.code_id = c.id
           AND a.expires_at > ?
          GROUP BY c.id
          ORDER BY c.active DESC, c.created_at DESC`,
    args: [now],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    label: String(row.label || ""),
    durationDays: Number(row.duration_days || 0),
    active: Boolean(row.active),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    activeGrantCount: Number(row.active_grant_count || 0),
  }));
}

export async function createDiscussionAccessCode(input: {
  label: string;
  code: string;
  durationDays: number;
}) {
  await ensureDiscussionAccessTables();
  const normalized = normalizeCode(input.code);
  const label = input.label.trim() || `${input.durationDays}일 코드`;
  const durationDays = Math.max(1, Math.min(3650, Math.floor(input.durationDays)));
  if (!normalized || normalized.length < 4) {
    throw new Error("접근 코드는 4자 이상으로 설정하세요.");
  }

  await db.execute({
    sql: `INSERT INTO discussion_access_codes
          (label, code_hash, duration_days, active, created_at, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [label, hashDiscussionCode(normalized), durationDays],
  });

  return listDiscussionAccessCodes();
}

export async function setDiscussionAccessCodeActive(id: number, active: boolean) {
  await ensureDiscussionAccessTables();
  await db.execute({
    sql: `UPDATE discussion_access_codes
          SET active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [active ? 1 : 0, id],
  });
  return listDiscussionAccessCodes();
}

export async function setDiscussionAccessCode(code: string) {
  await ensureDiscussionAccessTables();
  const normalized = normalizeCode(code);
  const value = normalized ? hashDiscussionCode(normalized) : "";

  if (value) {
    await db.execute({
      sql: `INSERT INTO discussion_access_codes
            (label, code_hash, duration_days, active, created_at, updated_at)
            VALUES ('기본 코드', ?, 365, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(code_hash) DO UPDATE SET
              active = 1,
              updated_at = CURRENT_TIMESTAMP`,
      args: [value],
    });
  } else {
    await db.execute("UPDATE discussion_access_codes SET active = 0");
  }

  return Boolean(value);
}

export async function verifyDiscussionAccessCode(
  code: string
): Promise<VerifiedDiscussionCode | null> {
  await ensureDiscussionAccessTables();
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const codeHash = hashDiscussionCode(normalized);
  const result = await db.execute({
    sql: `SELECT id, code_hash, duration_days
          FROM discussion_access_codes
          WHERE active = 1`,
  });

  for (const row of result.rows) {
    const storedHash = typeof row.code_hash === "string" ? row.code_hash : "";
    if (storedHash && secureEqual(codeHash, storedHash)) {
      return {
        id: Number(row.id),
        codeHash: storedHash,
        durationDays: Number(row.duration_days || 1),
      };
    }
  }

  return null;
}

export async function grantDiscussionAccess(
  userId: string,
  code: VerifiedDiscussionCode
) {
  await ensureDiscussionAccessTables();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + code.durationDays);

  await db.execute({
    sql: `INSERT INTO user_discussion_access
          (user_id, code_id, code_hash, granted_at, expires_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            code_id = excluded.code_id,
            code_hash = excluded.code_hash,
            granted_at = excluded.granted_at,
            expires_at = excluded.expires_at`,
    args: [userId, code.id, code.codeHash, now.toISOString(), expiresAt.toISOString()],
  });
}

export async function getDiscussionAccessStatus(userId: string | null) {
  await ensureDiscussionAccessTables();
  const configuredResult = await db.execute(
    "SELECT COUNT(*) AS count FROM discussion_access_codes WHERE active = 1"
  );
  const configured = Number(configuredResult.rows[0]?.count || 0) > 0;
  if (!userId) {
    return { configured, hasAccess: false, grantedAt: null, expiresAt: null };
  }

  const result = await db.execute({
    sql: `SELECT
            a.code_id,
            a.code_hash,
            a.granted_at,
            a.expires_at,
            c.active
          FROM user_discussion_access a
          LEFT JOIN discussion_access_codes c
            ON c.id = a.code_id
            OR (a.code_id IS NULL AND c.code_hash = a.code_hash)
          WHERE a.user_id = ?
          LIMIT 1`,
    args: [userId],
  });
  const row = result.rows[0];
  const grantedAt = row?.granted_at;
  const expiresAt = row?.expires_at;
  const active = Boolean(row?.active);
  const expiryTime =
    typeof expiresAt === "string" ? new Date(expiresAt).getTime() : 0;

  return {
    configured,
    hasAccess:
      configured &&
      typeof grantedAt === "string" &&
      Boolean(grantedAt) &&
      active &&
      Number.isFinite(expiryTime) &&
      expiryTime > Date.now(),
    grantedAt: typeof grantedAt === "string" ? grantedAt : null,
    expiresAt: typeof expiresAt === "string" ? expiresAt : null,
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
