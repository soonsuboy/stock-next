import { db } from "@/lib/db";

export type MetricSelection = "all" | "missing" | "existing";

export interface BatchSettings {
  scheduleEnabled: boolean;
  scheduleTimeKst: string;
  scheduleWindowMinutes: number;
  companyMasterEnabled: boolean;
  companyMasterDay: number;
  krEnabled: boolean;
  krDay: number;
  krLimit: number;
  usEnabled: boolean;
  usLimit: number;
  usShardCount: number;
  scheduledSelection: MetricSelection;
  watchlistSkipRecentHours: number;
}

export interface BatchSchedulerMeta {
  lastScheduledRunDateKst: string;
  lastSchedulerCheckAt: string;
  lastSchedulerCheckReason: string;
  lastScheduledRunStartedAt: string;
  lastScheduledRunCompletedAt: string;
  lastScheduledRunStatus: string;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  schedule_enabled: "true",
  schedule_time_kst: "03:00",
  schedule_window_minutes: "1440",
  company_master_enabled: "true",
  company_master_day: "7",
  kr_enabled: "true",
  kr_day: "7",
  kr_limit: "0",
  us_enabled: "true",
  us_limit: "1000",
  us_shard_count: "7",
  scheduled_selection: "all",
  watchlist_skip_recent_hours: "24",
  last_scheduled_run_date_kst: "",
  last_scheduler_check_at: "",
  last_scheduler_check_reason: "",
  last_scheduled_run_started_at: "",
  last_scheduled_run_completed_at: "",
  last_scheduled_run_status: "",
};

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) return fallback;
  return Math.max(min, Math.min(max, numberValue));
}

function parseTime(value: string | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "03:00";
  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "03:00";
  return value;
}

function parseSelection(value: string | undefined): MetricSelection {
  if (value === "missing" || value === "existing") return value;
  return "all";
}

function serializeSettings(settings: BatchSettings): Record<string, string> {
  return {
    schedule_enabled: String(settings.scheduleEnabled),
    schedule_time_kst: settings.scheduleTimeKst,
    schedule_window_minutes: String(settings.scheduleWindowMinutes),
    company_master_enabled: String(settings.companyMasterEnabled),
    company_master_day: String(settings.companyMasterDay),
    kr_enabled: String(settings.krEnabled),
    kr_day: String(settings.krDay),
    kr_limit: String(settings.krLimit),
    us_enabled: String(settings.usEnabled),
    us_limit: String(settings.usLimit),
    us_shard_count: String(settings.usShardCount),
    scheduled_selection: settings.scheduledSelection,
    watchlist_skip_recent_hours: String(settings.watchlistSkipRecentHours),
  };
}

function parseSettings(values: Record<string, string>): BatchSettings {
  return {
    scheduleEnabled: parseBoolean(values.schedule_enabled, true),
    scheduleTimeKst: parseTime(values.schedule_time_kst),
    scheduleWindowMinutes: parseInteger(
      values.schedule_window_minutes,
      1440,
      5,
      1440
    ),
    companyMasterEnabled: parseBoolean(values.company_master_enabled, true),
    companyMasterDay: parseInteger(values.company_master_day, 7, 1, 7),
    krEnabled: parseBoolean(values.kr_enabled, true),
    krDay: parseInteger(values.kr_day, 7, 1, 7),
    krLimit: parseInteger(values.kr_limit, 0, 0, 5000),
    usEnabled: parseBoolean(values.us_enabled, true),
    usLimit: parseInteger(values.us_limit, 1000, 0, 5000),
    usShardCount: parseInteger(values.us_shard_count, 7, 1, 31),
    scheduledSelection: parseSelection(values.scheduled_selection),
    watchlistSkipRecentHours: parseInteger(
      values.watchlist_skip_recent_hours,
      24,
      0,
      168
    ),
  };
}

export async function ensureBatchSettings() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS batch_settings (
       key        TEXT PRIMARY KEY,
       value      TEXT NOT NULL,
       updated_at TEXT
     )`
  );

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO batch_settings(key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)`,
      args: [key, value],
    });
  }
}

export async function getBatchSettings(): Promise<BatchSettings> {
  await ensureBatchSettings();
  const result = await db.execute(
    "SELECT key, value FROM batch_settings ORDER BY key"
  );
  const values = { ...DEFAULT_SETTINGS };

  for (const row of result.rows) {
    if (typeof row.key === "string" && typeof row.value === "string") {
      values[row.key] = row.value;
    }
  }

  return parseSettings(values);
}

export async function getBatchSchedulerMeta(): Promise<BatchSchedulerMeta> {
  await ensureBatchSettings();
  const result = await db.execute(
    `SELECT key, value
     FROM batch_settings
     WHERE key IN (
       'last_scheduled_run_date_kst',
       'last_scheduler_check_at',
       'last_scheduler_check_reason',
       'last_scheduled_run_started_at',
       'last_scheduled_run_completed_at',
       'last_scheduled_run_status'
     )`
  );
  const values = { ...DEFAULT_SETTINGS };

  for (const row of result.rows) {
    if (typeof row.key === "string" && typeof row.value === "string") {
      values[row.key] = row.value;
    }
  }

  return {
    lastScheduledRunDateKst: values.last_scheduled_run_date_kst,
    lastSchedulerCheckAt: values.last_scheduler_check_at,
    lastSchedulerCheckReason: values.last_scheduler_check_reason,
    lastScheduledRunStartedAt: values.last_scheduled_run_started_at,
    lastScheduledRunCompletedAt: values.last_scheduled_run_completed_at,
    lastScheduledRunStatus: values.last_scheduled_run_status,
  };
}

export function normalizeBatchSettings(input: unknown): BatchSettings {
  const source =
    input && typeof input === "object"
      ? (input as Partial<Record<keyof BatchSettings, unknown>>)
      : {};

  return parseSettings({
    schedule_enabled: String(source.scheduleEnabled ?? "true"),
    schedule_time_kst: String(source.scheduleTimeKst ?? "03:00"),
    schedule_window_minutes: String(source.scheduleWindowMinutes ?? "1440"),
    company_master_enabled: String(source.companyMasterEnabled ?? "true"),
    company_master_day: String(source.companyMasterDay ?? "7"),
    kr_enabled: String(source.krEnabled ?? "true"),
    kr_day: String(source.krDay ?? "7"),
    kr_limit: String(source.krLimit ?? "0"),
    us_enabled: String(source.usEnabled ?? "true"),
    us_limit: String(source.usLimit ?? "1000"),
    us_shard_count: String(source.usShardCount ?? "7"),
    scheduled_selection: String(source.scheduledSelection ?? "all"),
    watchlist_skip_recent_hours: String(source.watchlistSkipRecentHours ?? "24"),
  });
}

export async function saveBatchSettings(input: unknown) {
  await ensureBatchSettings();
  const settings = normalizeBatchSettings(input);
  const serialized = serializeSettings(settings);

  for (const [key, value] of Object.entries(serialized)) {
    await db.execute({
      sql: `INSERT INTO batch_settings(key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at`,
      args: [key, value],
    });
  }

  return getBatchSettings();
}
