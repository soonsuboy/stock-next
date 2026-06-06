import { db } from "@/lib/db";

export const assetCategories = [
  { key: "crypto", label: "코인", column: "crypto_amount" },
  { key: "koreaStock", label: "한국주식", column: "korea_stock_amount" },
  { key: "usStock", label: "미국주식", column: "us_stock_amount" },
  { key: "realEstate", label: "부동산", column: "real_estate_amount" },
  { key: "cash", label: "현금", column: "cash_amount" },
] as const;

export type AssetCategoryKey = (typeof assetCategories)[number]["key"];

export interface AssetPerson {
  id: string;
  name: string;
  createdAt: string | null;
}

export interface AssetGroup {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string | null;
}

export interface AssetSnapshotInput {
  personId: string;
  yearMonth: string;
  crypto: number;
  koreaStock: number;
  usStock: number;
  realEstate: number;
  cash: number;
}

export interface AssetSnapshot extends AssetSnapshotInput {
  total: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AssetData {
  people: AssetPerson[];
  groups: AssetGroup[];
  snapshots: AssetSnapshot[];
}

let assetSchemaReady: Promise<void> | null = null;

function newId(prefix: string) {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

async function ensureLegacyAssetSnapshotsTable() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS asset_snapshots (
       user_id             TEXT NOT NULL,
       year_month          TEXT NOT NULL,
       crypto_amount       REAL NOT NULL DEFAULT 0,
       korea_stock_amount  REAL NOT NULL DEFAULT 0,
       us_stock_amount     REAL NOT NULL DEFAULT 0,
       real_estate_amount  REAL NOT NULL DEFAULT 0,
       cash_amount         REAL NOT NULL DEFAULT 0,
       created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, year_month)
     )`
  );
}

async function ensureAssetSchemaUncached() {
  await ensureLegacyAssetSnapshotsTable();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS asset_people (
       id          TEXT PRIMARY KEY,
       user_id     TEXT NOT NULL,
       name        TEXT NOT NULL,
       created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(user_id, name)
     )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS asset_groups (
       id          TEXT PRIMARY KEY,
       user_id     TEXT NOT NULL,
       name        TEXT NOT NULL,
       created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(user_id, name)
     )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS asset_group_members (
       group_id    TEXT NOT NULL,
       person_id   TEXT NOT NULL,
       created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (group_id, person_id)
     )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS asset_person_asset_snapshots (
       user_id             TEXT NOT NULL,
       person_id           TEXT NOT NULL,
       year_month          TEXT NOT NULL,
       crypto_amount       REAL NOT NULL DEFAULT 0,
       korea_stock_amount  REAL NOT NULL DEFAULT 0,
       us_stock_amount     REAL NOT NULL DEFAULT 0,
       real_estate_amount  REAL NOT NULL DEFAULT 0,
       cash_amount         REAL NOT NULL DEFAULT 0,
       created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, person_id, year_month)
     )`
  );
}

export async function ensureAssetSchema() {
  assetSchemaReady ??= ensureAssetSchemaUncached();
  return assetSchemaReady;
}

export function isValidYearMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeAmount(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseAssetSnapshotInput(
  payload: Record<string, unknown>
): AssetSnapshotInput | null {
  const personId = normalizeId(payload.personId);
  if (!personId || !isValidYearMonth(payload.yearMonth)) return null;

  const crypto = normalizeAmount(payload.crypto);
  const koreaStock = normalizeAmount(payload.koreaStock);
  const usStock = normalizeAmount(payload.usStock);
  const realEstate = normalizeAmount(payload.realEstate);
  const cash = normalizeAmount(payload.cash);

  if (
    crypto === null ||
    koreaStock === null ||
    usStock === null ||
    realEstate === null ||
    cash === null
  ) {
    return null;
  }

  return {
    personId,
    yearMonth: payload.yearMonth,
    crypto,
    koreaStock,
    usStock,
    realEstate,
    cash,
  };
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function rowToPerson(row: Record<string, unknown>): AssetPerson {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    createdAt: toStringOrNull(row.created_at),
  };
}

function rowToGroup(row: Record<string, unknown>): AssetGroup {
  const memberIds =
    typeof row.member_ids === "string" && row.member_ids
      ? row.member_ids.split(",").filter(Boolean)
      : [];

  return {
    id: String(row.id),
    name: String(row.name || ""),
    memberIds,
    createdAt: toStringOrNull(row.created_at),
  };
}

function rowToAssetSnapshot(row: Record<string, unknown>): AssetSnapshot {
  const snapshot = {
    personId: String(row.person_id || ""),
    yearMonth: String(row.year_month || ""),
    crypto: toNumber(row.crypto_amount),
    koreaStock: toNumber(row.korea_stock_amount),
    usStock: toNumber(row.us_stock_amount),
    realEstate: toNumber(row.real_estate_amount),
    cash: toNumber(row.cash_amount),
    createdAt: toStringOrNull(row.created_at),
    updatedAt: toStringOrNull(row.updated_at),
  };

  return {
    ...snapshot,
    total:
      snapshot.crypto +
      snapshot.koreaStock +
      snapshot.usStock +
      snapshot.realEstate +
      snapshot.cash,
  };
}

async function getOrCreateDefaultPerson(userId: string) {
  const existing = await db.execute({
    sql: `SELECT id FROM asset_people
          WHERE user_id = ?
          ORDER BY created_at ASC
          LIMIT 1`,
    args: [userId],
  });

  if (existing.rows[0]?.id) {
    return String(existing.rows[0].id);
  }

  const id = newId("person");
  await db.execute({
    sql: `INSERT INTO asset_people(id, user_id, name, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, userId, "본인"],
  });
  return id;
}

async function getOrCreateDefaultGroup(userId: string, memberId: string) {
  const existing = await db.execute({
    sql: `SELECT id FROM asset_groups
          WHERE user_id = ?
          ORDER BY created_at ASC
          LIMIT 1`,
    args: [userId],
  });

  if (existing.rows[0]?.id) {
    const groupId = String(existing.rows[0].id);
    await db.execute({
      sql: `INSERT OR IGNORE INTO asset_group_members(group_id, person_id)
            VALUES (?, ?)`,
      args: [groupId, memberId],
    });
    return groupId;
  }

  const id = newId("group");
  await db.execute({
    sql: `INSERT INTO asset_groups(id, user_id, name, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, userId, "우리 가구"],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO asset_group_members(group_id, person_id)
          VALUES (?, ?)`,
    args: [id, memberId],
  });
  return id;
}

async function migrateLegacySnapshots(userId: string, personId: string) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO asset_person_asset_snapshots (
            user_id,
            person_id,
            year_month,
            crypto_amount,
            korea_stock_amount,
            us_stock_amount,
            real_estate_amount,
            cash_amount,
            created_at,
            updated_at
          )
          SELECT
            user_id,
            ?,
            year_month,
            crypto_amount,
            korea_stock_amount,
            us_stock_amount,
            real_estate_amount,
            cash_amount,
            created_at,
            updated_at
          FROM asset_snapshots
          WHERE user_id = ?`,
    args: [personId, userId],
  });
}

async function ensureUserAssetDefaults(userId: string) {
  await ensureAssetSchema();
  const personId = await getOrCreateDefaultPerson(userId);
  await getOrCreateDefaultGroup(userId, personId);
  await migrateLegacySnapshots(userId, personId);
}

async function assertPersonBelongsToUser(userId: string, personId: string) {
  const result = await db.execute({
    sql: "SELECT id FROM asset_people WHERE user_id = ? AND id = ? LIMIT 1",
    args: [userId, personId],
  });
  return result.rows.length > 0;
}

async function filterUserPersonIds(userId: string, memberIds: string[]) {
  if (memberIds.length === 0) return [];

  const people = await listAssetPeople(userId);
  const allowed = new Set(people.map((person) => person.id));
  return Array.from(new Set(memberIds.filter((id) => allowed.has(id))));
}

export async function listAssetPeople(userId: string) {
  await ensureAssetSchema();
  const result = await db.execute({
    sql: `SELECT id, name, created_at
          FROM asset_people
          WHERE user_id = ?
          ORDER BY created_at ASC`,
    args: [userId],
  });

  return result.rows.map((row) => rowToPerson(row as Record<string, unknown>));
}

export async function listAssetGroups(userId: string) {
  await ensureAssetSchema();
  const result = await db.execute({
    sql: `SELECT
            g.id,
            g.name,
            g.created_at,
            GROUP_CONCAT(gm.person_id) AS member_ids
          FROM asset_groups g
          LEFT JOIN asset_group_members gm ON gm.group_id = g.id
          WHERE g.user_id = ?
          GROUP BY g.id, g.name, g.created_at
          ORDER BY g.created_at ASC`,
    args: [userId],
  });

  return result.rows.map((row) => rowToGroup(row as Record<string, unknown>));
}

export async function listAssetSnapshots(userId: string) {
  await ensureUserAssetDefaults(userId);
  const result = await db.execute({
    sql: `SELECT
            person_id,
            year_month,
            crypto_amount,
            korea_stock_amount,
            us_stock_amount,
            real_estate_amount,
            cash_amount,
            created_at,
            updated_at
          FROM asset_person_asset_snapshots
          WHERE user_id = ?
          ORDER BY year_month ASC, created_at ASC`,
    args: [userId],
  });

  return result.rows.map((row) =>
    rowToAssetSnapshot(row as Record<string, unknown>)
  );
}

export async function getAssetData(userId: string): Promise<AssetData> {
  await ensureUserAssetDefaults(userId);
  const [people, groups, snapshots] = await Promise.all([
    listAssetPeople(userId),
    listAssetGroups(userId),
    listAssetSnapshots(userId),
  ]);

  return { people, groups, snapshots };
}

export async function upsertAssetSnapshot(
  userId: string,
  snapshot: AssetSnapshotInput
) {
  await ensureUserAssetDefaults(userId);
  const validPerson = await assertPersonBelongsToUser(userId, snapshot.personId);
  if (!validPerson) {
    throw new Error("Person not found");
  }

  await db.execute({
    sql: `INSERT INTO asset_person_asset_snapshots (
            user_id,
            person_id,
            year_month,
            crypto_amount,
            korea_stock_amount,
            us_stock_amount,
            real_estate_amount,
            cash_amount,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, person_id, year_month) DO UPDATE SET
            crypto_amount = excluded.crypto_amount,
            korea_stock_amount = excluded.korea_stock_amount,
            us_stock_amount = excluded.us_stock_amount,
            real_estate_amount = excluded.real_estate_amount,
            cash_amount = excluded.cash_amount,
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      userId,
      snapshot.personId,
      snapshot.yearMonth,
      snapshot.crypto,
      snapshot.koreaStock,
      snapshot.usStock,
      snapshot.realEstate,
      snapshot.cash,
    ],
  });
}

export async function deleteAssetSnapshot(
  userId: string,
  personId: string,
  yearMonth: string
) {
  await ensureUserAssetDefaults(userId);
  await db.execute({
    sql: `DELETE FROM asset_person_asset_snapshots
          WHERE user_id = ? AND person_id = ? AND year_month = ?`,
    args: [userId, personId, yearMonth],
  });
}

export async function createAssetPerson(userId: string, nameValue: unknown) {
  await ensureUserAssetDefaults(userId);
  const name = normalizeName(nameValue);
  if (!name) throw new Error("Name is required");

  const id = newId("person");
  await db.execute({
    sql: `INSERT INTO asset_people(id, user_id, name, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, userId, name],
  });

  const groups = await listAssetGroups(userId);
  const defaultGroup = groups[0];
  if (defaultGroup) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO asset_group_members(group_id, person_id)
            VALUES (?, ?)`,
      args: [defaultGroup.id, id],
    });
  }

  return id;
}

export async function deleteAssetPerson(userId: string, personId: string) {
  await ensureUserAssetDefaults(userId);
  const people = await listAssetPeople(userId);
  if (people.length <= 1) {
    throw new Error("At least one person is required");
  }

  const validPerson = await assertPersonBelongsToUser(userId, personId);
  if (!validPerson) throw new Error("Person not found");

  await db.execute({
    sql: `DELETE FROM asset_group_members WHERE person_id = ?`,
    args: [personId],
  });
  await db.execute({
    sql: `DELETE FROM asset_person_asset_snapshots
          WHERE user_id = ? AND person_id = ?`,
    args: [userId, personId],
  });
  await db.execute({
    sql: `DELETE FROM asset_people
          WHERE user_id = ? AND id = ?`,
    args: [userId, personId],
  });
}

export async function createAssetGroup(
  userId: string,
  nameValue: unknown,
  memberIdValues: unknown
) {
  await ensureUserAssetDefaults(userId);
  const name = normalizeName(nameValue);
  if (!name) throw new Error("Name is required");

  const memberIds = Array.isArray(memberIdValues)
    ? memberIdValues.map(normalizeId).filter(Boolean)
    : [];
  const filteredMemberIds = await filterUserPersonIds(userId, memberIds);

  const id = newId("group");
  await db.execute({
    sql: `INSERT INTO asset_groups(id, user_id, name, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [id, userId, name],
  });

  for (const memberId of filteredMemberIds) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO asset_group_members(group_id, person_id)
            VALUES (?, ?)`,
      args: [id, memberId],
    });
  }

  return id;
}

export async function updateAssetGroup(
  userId: string,
  groupId: string,
  nameValue: unknown,
  memberIdValues: unknown
) {
  await ensureUserAssetDefaults(userId);
  const name = normalizeName(nameValue);
  if (!name) throw new Error("Name is required");

  const group = await db.execute({
    sql: "SELECT id FROM asset_groups WHERE user_id = ? AND id = ? LIMIT 1",
    args: [userId, groupId],
  });
  if (group.rows.length === 0) throw new Error("Group not found");

  const memberIds = Array.isArray(memberIdValues)
    ? memberIdValues.map(normalizeId).filter(Boolean)
    : [];
  const filteredMemberIds = await filterUserPersonIds(userId, memberIds);

  await db.execute({
    sql: `UPDATE asset_groups
          SET name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND id = ?`,
    args: [name, userId, groupId],
  });
  await db.execute({
    sql: "DELETE FROM asset_group_members WHERE group_id = ?",
    args: [groupId],
  });
  for (const memberId of filteredMemberIds) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO asset_group_members(group_id, person_id)
            VALUES (?, ?)`,
      args: [groupId, memberId],
    });
  }
}

export async function deleteAssetGroup(userId: string, groupId: string) {
  await ensureUserAssetDefaults(userId);
  const groups = await listAssetGroups(userId);
  if (groups.length <= 1) {
    throw new Error("At least one group is required");
  }

  await db.execute({
    sql: "DELETE FROM asset_group_members WHERE group_id = ?",
    args: [groupId],
  });
  await db.execute({
    sql: `DELETE FROM asset_groups
          WHERE user_id = ? AND id = ?`,
    args: [userId, groupId],
  });
}
