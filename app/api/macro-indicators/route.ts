import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export interface MacroIndicator {
  key: string;
  region: string;
  label: string;
  value: number | null;
  unit: string | null;
  displayValue: string;
  source: string | null;
  status: string;
  note: string | null;
  snapshotDate: string;
  createdAt: string | null;
}

async function ensureMacroIndicators() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS macro_indicators (
       snapshot_date TEXT NOT NULL,
       indicator_key TEXT NOT NULL,
       region        TEXT NOT NULL,
       label         TEXT NOT NULL,
       value         REAL,
       unit          TEXT,
       display_value TEXT,
       source        TEXT,
       status        TEXT NOT NULL DEFAULT 'ok',
       note          TEXT,
       created_at    TEXT,
       PRIMARY KEY(snapshot_date, indicator_key)
     )`
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureMacroIndicators();
    const result = await db.execute(
      `WITH latest AS (
         SELECT indicator_key, MAX(created_at) AS created_at
         FROM macro_indicators
         GROUP BY indicator_key
       )
       SELECT
         m.snapshot_date,
         m.indicator_key,
         m.region,
         m.label,
         m.value,
         m.unit,
         m.display_value,
         m.source,
         m.status,
         m.note,
         m.created_at
       FROM macro_indicators m
       JOIN latest l
         ON l.indicator_key = m.indicator_key
        AND l.created_at = m.created_at`
    );

    const indicators: MacroIndicator[] = result.rows.map((row) => ({
      key: String(row.indicator_key),
      region: String(row.region),
      label: String(row.label),
      value: typeof row.value === "number" ? row.value : null,
      unit: typeof row.unit === "string" ? row.unit : null,
      displayValue:
        typeof row.display_value === "string" ? row.display_value : "-",
      source: typeof row.source === "string" ? row.source : null,
      status: typeof row.status === "string" ? row.status : "ok",
      note: typeof row.note === "string" ? row.note : null,
      snapshotDate: String(row.snapshot_date),
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
    }));

    return NextResponse.json({
      indicators,
      updatedAt:
        indicators
          .map((item) => item.createdAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) || null,
    });
  } catch (error) {
    console.error("Macro indicator fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch macro indicators" },
      { status: 500 }
    );
  }
}
