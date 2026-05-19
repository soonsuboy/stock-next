import { db } from "@/lib/db";

let metricsPriceColumnsReady: Promise<void> | null = null;

async function hasMetricsColumn(columnName: string) {
  const result = await db.execute("PRAGMA table_info(metrics_history)");
  return result.rows.some((row) => row.name === columnName);
}

async function ensureMetricsPriceColumnsUncached() {
  if (!(await hasMetricsColumn("previous_close"))) {
    await db.execute("ALTER TABLE metrics_history ADD COLUMN previous_close REAL");
  }
  if (!(await hasMetricsColumn("change_rate"))) {
    await db.execute("ALTER TABLE metrics_history ADD COLUMN change_rate REAL");
  }
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_metrics_history_change_rate ON metrics_history(country, change_rate)"
  );
}

export async function ensureMetricsPriceColumns() {
  metricsPriceColumnsReady ??= ensureMetricsPriceColumnsUncached();
  return metricsPriceColumnsReady;
}
