import { db } from "@/lib/db";
import { GICS_SECTOR_GUIDES, GICS_SECTORS } from "@/lib/gics-sector";

export interface SectorGuide {
  name: string;
  guidePer: string;
  guidePbr: string;
  guideRoe: string;
  summary: string;
  sortOrder: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SectorGuideInput {
  originalName?: string;
  name: string;
  guidePer: string;
  guidePbr: string;
  guideRoe: string;
  summary: string;
  sortOrder?: number;
  active?: boolean;
}

let sectorGuideTableReady: Promise<void> | null = null;

export function normalizeSectorName(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureSectorGuideTableUncached() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS stock_sector_guides (
       name TEXT PRIMARY KEY,
       guide_per TEXT,
       guide_pbr TEXT,
       guide_roe TEXT,
       summary TEXT,
       sort_order INTEGER DEFAULT 999,
       active INTEGER NOT NULL DEFAULT 1,
       created_at TEXT DEFAULT CURRENT_TIMESTAMP,
       updated_at TEXT DEFAULT CURRENT_TIMESTAMP
     )`
  );

  for (const [index, name] of GICS_SECTORS.entries()) {
    const guide = GICS_SECTOR_GUIDES[name];
    await db.execute({
      sql: `INSERT OR IGNORE INTO stock_sector_guides
              (name, guide_per, guide_pbr, guide_roe, summary, sort_order, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [
        name,
        guide.per,
        guide.pbr,
        guide.roe,
        guide.summary,
        index + 1,
      ],
    });
  }
}

export async function ensureSectorGuideTable() {
  sectorGuideTableReady ??= ensureSectorGuideTableUncached();
  return sectorGuideTableReady;
}

function rowToSectorGuide(row: Record<string, unknown>): SectorGuide {
  return {
    name: String(row.name || ""),
    guidePer: String(row.guide_per || ""),
    guidePbr: String(row.guide_pbr || ""),
    guideRoe: String(row.guide_roe || ""),
    summary: String(row.summary || ""),
    sortOrder: Number(row.sort_order || 999),
    active: Number(row.active ?? 1) === 1,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function getSectorGuides(options?: { includeInactive?: boolean }) {
  await ensureSectorGuideTable();
  const result = await db.execute({
    sql: `SELECT name, guide_per, guide_pbr, guide_roe, summary, sort_order,
                 active, created_at, updated_at
          FROM stock_sector_guides
          ${options?.includeInactive ? "" : "WHERE active = 1"}
          ORDER BY sort_order ASC, name ASC`,
    args: [],
  });

  return result.rows.map((row) =>
    rowToSectorGuide(row as Record<string, unknown>)
  );
}

export async function getActiveSectorNames() {
  const guides = await getSectorGuides();
  return new Set(guides.map((guide) => guide.name));
}

export async function saveSectorGuide(input: SectorGuideInput) {
  await ensureSectorGuideTable();
  const name = normalizeSectorName(input.name);
  const originalName = normalizeSectorName(input.originalName) || name;

  if (!name || !originalName) {
    throw new Error("Sector name is required");
  }

  const active = input.active === false ? 0 : 1;
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.max(1, Math.floor(input.sortOrder))
      : 999;

  const existing = await db.execute({
    sql: "SELECT name FROM stock_sector_guides WHERE name = ?",
    args: [originalName],
  });

  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO stock_sector_guides
              (name, guide_per, guide_pbr, guide_roe, summary, sort_order, active,
               created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        name,
        input.guidePer,
        input.guidePbr,
        input.guideRoe,
        input.summary,
        sortOrder,
        active,
      ],
    });
    return;
  }

  if (name !== originalName) {
    const duplicate = await db.execute({
      sql: "SELECT name FROM stock_sector_guides WHERE name = ?",
      args: [name],
    });
    if (duplicate.rows.length > 0) {
      throw new Error("Sector name already exists");
    }
  }

  await db.execute({
    sql: `UPDATE stock_sector_guides
          SET name = ?,
              guide_per = ?,
              guide_pbr = ?,
              guide_roe = ?,
              summary = ?,
              sort_order = ?,
              active = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE name = ?`,
    args: [
      name,
      input.guidePer,
      input.guidePbr,
      input.guideRoe,
      input.summary,
      sortOrder,
      active,
      originalName,
    ],
  });

  if (name !== originalName) {
    await db.execute({
      sql: "UPDATE companies SET gics_sector = ? WHERE gics_sector = ?",
      args: [name, originalName],
    });
  }
}
