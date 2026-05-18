import { db } from "@/lib/db";

export interface ManagedAppUser {
  id: string;
  provider: string;
  providerAccountId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  active: boolean;
  disabledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  watchlistCount: number;
}

let appUsersReady: Promise<void> | null = null;

async function userColumnNames() {
  const result = await db.execute("PRAGMA table_info(app_users)");
  return new Set(result.rows.map((row) => String(row.name)));
}

async function ensureColumn(name: string, definition: string) {
  const columns = await userColumnNames();
  if (!columns.has(name)) {
    await db.execute(`ALTER TABLE app_users ADD COLUMN ${name} ${definition}`);
  }
}

async function ensureAppUsersTableUncached() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS app_users (
       id                  TEXT PRIMARY KEY,
       provider            TEXT NOT NULL,
       provider_account_id TEXT NOT NULL,
       name                TEXT,
       email               TEXT,
       image               TEXT,
       active              INTEGER NOT NULL DEFAULT 1,
       disabled_at         TEXT,
       last_login_at       TEXT,
       created_at          TEXT,
       updated_at          TEXT,
       UNIQUE(provider, provider_account_id)
     )`
  );
  await ensureColumn("active", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn("disabled_at", "TEXT");
  await ensureColumn("last_login_at", "TEXT");
}

export async function ensureAppUsersTable() {
  appUsersReady ??= ensureAppUsersTableUncached();
  return appUsersReady;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function rowToManagedUser(row: Record<string, unknown>): ManagedAppUser {
  return {
    id: String(row.id),
    provider: String(row.provider || ""),
    providerAccountId: String(row.provider_account_id || ""),
    name: toStringOrNull(row.name),
    email: toStringOrNull(row.email),
    image: toStringOrNull(row.image),
    active: Number(row.active ?? 1) === 1,
    disabledAt: toStringOrNull(row.disabled_at),
    lastLoginAt: toStringOrNull(row.last_login_at),
    createdAt: toStringOrNull(row.created_at),
    updatedAt: toStringOrNull(row.updated_at),
    watchlistCount: toNumber(row.watchlist_count),
  };
}

export async function isAppUserActive(userId: string) {
  await ensureAppUsersTable();
  const result = await db.execute({
    sql: "SELECT active FROM app_users WHERE id = ? LIMIT 1",
    args: [userId],
  });

  if (result.rows.length === 0) return false;
  return Number(result.rows[0].active ?? 1) === 1;
}

export async function listManagedAppUsers() {
  await ensureAppUsersTable();
  const result = await db.execute({
    sql: `SELECT
            u.id,
            u.provider,
            u.provider_account_id,
            u.name,
            u.email,
            u.image,
            u.active,
            u.disabled_at,
            u.last_login_at,
            u.created_at,
            u.updated_at,
            COUNT(uw.id) AS watchlist_count
          FROM app_users u
          LEFT JOIN user_watchlist uw ON uw.user_id = u.id
          GROUP BY
            u.id,
            u.provider,
            u.provider_account_id,
            u.name,
            u.email,
            u.image,
            u.active,
            u.disabled_at,
            u.last_login_at,
            u.created_at,
            u.updated_at
          ORDER BY COALESCE(u.last_login_at, u.updated_at, u.created_at) DESC`,
  });

  return result.rows.map((row) =>
    rowToManagedUser(row as Record<string, unknown>)
  );
}

export async function setAppUserActive(userId: string, active: boolean) {
  await ensureAppUsersTable();
  const existing = await db.execute({
    sql: "SELECT id FROM app_users WHERE id = ? LIMIT 1",
    args: [userId],
  });

  if (existing.rows.length === 0) {
    throw new Error("User not found");
  }

  await db.execute({
    sql: `UPDATE app_users
          SET active = ?,
              disabled_at = CASE WHEN ? = 1 THEN NULL ELSE CURRENT_TIMESTAMP END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [active ? 1 : 0, active ? 1 : 0, userId],
  });
}
