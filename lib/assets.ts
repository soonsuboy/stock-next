import { db } from "@/lib/db";

export const assetCategories = [
  { key: "crypto", label: "코인", column: "crypto_amount" },
  { key: "koreaStock", label: "한국주식", column: "korea_stock_amount" },
  { key: "usStock", label: "미국주식", column: "us_stock_amount" },
  { key: "realEstate", label: "부동산", column: "real_estate_amount" },
  { key: "cash", label: "현금", column: "cash_amount" },
] as const;

export type AssetCategoryKey = (typeof assetCategories)[number]["key"];

export interface AssetSnapshotInput {
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

let assetSnapshotsReady: Promise<void> | null = null;

async function ensureAssetSnapshotsTableUncached() {
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

export async function ensureAssetSnapshotsTable() {
  assetSnapshotsReady ??= ensureAssetSnapshotsTableUncached();
  return assetSnapshotsReady;
}

export function isValidYearMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizeAmount(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

export function parseAssetSnapshotInput(
  payload: Record<string, unknown>
): AssetSnapshotInput | null {
  if (!isValidYearMonth(payload.yearMonth)) return null;

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

function rowToAssetSnapshot(row: Record<string, unknown>): AssetSnapshot {
  const snapshot = {
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

export async function listAssetSnapshots(userId: string) {
  await ensureAssetSnapshotsTable();
  const result = await db.execute({
    sql: `SELECT
            year_month,
            crypto_amount,
            korea_stock_amount,
            us_stock_amount,
            real_estate_amount,
            cash_amount,
            created_at,
            updated_at
          FROM asset_snapshots
          WHERE user_id = ?
          ORDER BY year_month ASC`,
    args: [userId],
  });

  return result.rows.map((row) =>
    rowToAssetSnapshot(row as Record<string, unknown>)
  );
}

export async function upsertAssetSnapshot(
  userId: string,
  snapshot: AssetSnapshotInput
) {
  await ensureAssetSnapshotsTable();
  await db.execute({
    sql: `INSERT INTO asset_snapshots (
            user_id,
            year_month,
            crypto_amount,
            korea_stock_amount,
            us_stock_amount,
            real_estate_amount,
            cash_amount,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, year_month) DO UPDATE SET
            crypto_amount = excluded.crypto_amount,
            korea_stock_amount = excluded.korea_stock_amount,
            us_stock_amount = excluded.us_stock_amount,
            real_estate_amount = excluded.real_estate_amount,
            cash_amount = excluded.cash_amount,
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      userId,
      snapshot.yearMonth,
      snapshot.crypto,
      snapshot.koreaStock,
      snapshot.usStock,
      snapshot.realEstate,
      snapshot.cash,
    ],
  });
}

export async function deleteAssetSnapshot(userId: string, yearMonth: string) {
  await ensureAssetSnapshotsTable();
  await db.execute({
    sql: `DELETE FROM asset_snapshots
          WHERE user_id = ? AND year_month = ?`,
    args: [userId, yearMonth],
  });
}
