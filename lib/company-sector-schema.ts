import { db } from "@/lib/db";

let companySectorColumnsReady: Promise<void> | null = null;

async function hasCompanyColumn(columnName: string) {
  const result = await db.execute("PRAGMA table_info(companies)");
  return result.rows.some((row) => row.name === columnName);
}

async function ensureCompanySectorColumnsUncached() {
  if (!(await hasCompanyColumn("gics_sector"))) {
    await db.execute("ALTER TABLE companies ADD COLUMN gics_sector TEXT");
  }
  if (!(await hasCompanyColumn("industry_name"))) {
    await db.execute("ALTER TABLE companies ADD COLUMN industry_name TEXT");
  }
  if (!(await hasCompanyColumn("sector_source"))) {
    await db.execute("ALTER TABLE companies ADD COLUMN sector_source TEXT");
  }
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_companies_gics_sector ON companies(gics_sector)"
  );
}

export async function ensureCompanySectorColumns() {
  companySectorColumnsReady ??= ensureCompanySectorColumnsUncached();
  return companySectorColumnsReady;
}
