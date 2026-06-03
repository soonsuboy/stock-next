import { db } from "@/lib/db";

export type MetricSelection = "all" | "missing" | "existing";
export type MetricPriceMarket = "ALL" | "KR" | "US";

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
  metricPriceEnabled: boolean;
  metricPriceTimeKst: string;
  metricPriceMarket: MetricPriceMarket;
  metricPriceLimit: number;
  watchlistSkipRecentHours: number;
  watchlistPriceEnabled: boolean;
  watchlistPriceTimeKst: string;
  teacherWatchlistPriceEnabled: boolean;
  teacherWatchlistPriceTimeKst: string;
  telegramEnabled: boolean;
  telegramCollectHoursBack: number;
  telegramMessageLimit: number;
  telegramMediaEnabled: boolean;
  telegramMediaMaxBytes: number;
  telegramSummaryEnabled: boolean;
}

export interface BatchSchedulerMeta {
  lastScheduledRunDateKst: string;
  lastSchedulerCheckAt: string;
  lastSchedulerCheckReason: string;
  lastScheduledRunStartedAt: string;
  lastScheduledRunCompletedAt: string;
  lastScheduledRunStatus: string;
  lastWatchlistPriceRunDateKst: string;
  lastWatchlistPriceRunStartedAt: string;
  lastWatchlistPriceRunCompletedAt: string;
  lastWatchlistPriceRunStatus: string;
  lastWatchlistPriceCheckReason: string;
  lastTeacherWatchlistPriceRunDateKst: string;
  lastTeacherWatchlistPriceRunStartedAt: string;
  lastTeacherWatchlistPriceRunCompletedAt: string;
  lastTeacherWatchlistPriceRunStatus: string;
  lastTeacherWatchlistPriceCheckReason: string;
  lastMetricPriceRunDateKst: string;
  lastMetricPriceRunStartedAt: string;
  lastMetricPriceRunCompletedAt: string;
  lastMetricPriceRunStatus: string;
  lastMetricPriceCheckReason: string;
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
  metric_price_enabled: "true",
  metric_price_time_kst: "07:00",
  metric_price_market: "ALL",
  metric_price_limit: "0",
  watchlist_skip_recent_hours: "24",
  watchlist_price_enabled: "true",
  watchlist_price_time_kst: "06:30",
  teacher_watchlist_price_enabled: "true",
  teacher_watchlist_price_time_kst: "06:45",
  telegram_enabled: "false",
  telegram_collect_hours_back: "2",
  telegram_message_limit: "200",
  telegram_media_enabled: "true",
  telegram_media_max_bytes: "750000",
  telegram_summary_enabled: "true",
  discussion_access_code_hash: "",
  telegram_last_collect_hour_kst: "",
  last_scheduled_run_date_kst: "",
  last_scheduler_check_at: "",
  last_scheduler_check_reason: "",
  last_scheduled_run_started_at: "",
  last_scheduled_run_completed_at: "",
  last_scheduled_run_status: "",
  last_watchlist_price_run_date_kst: "",
  last_watchlist_price_run_started_at: "",
  last_watchlist_price_run_completed_at: "",
  last_watchlist_price_run_status: "",
  last_watchlist_price_check_reason: "",
  last_teacher_watchlist_price_run_date_kst: "",
  last_teacher_watchlist_price_run_started_at: "",
  last_teacher_watchlist_price_run_completed_at: "",
  last_teacher_watchlist_price_run_status: "",
  last_teacher_watchlist_price_check_reason: "",
  last_metric_price_run_date_kst: "",
  last_metric_price_run_started_at: "",
  last_metric_price_run_completed_at: "",
  last_metric_price_run_status: "",
  last_metric_price_check_reason: "",
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

function parseTime(value: string | undefined, fallback = "03:00") {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return value;
}

function parseSelection(value: string | undefined): MetricSelection {
  if (value === "missing" || value === "existing") return value;
  return "all";
}

function parseMetricPriceMarket(value: string | undefined): MetricPriceMarket {
  if (value === "KR" || value === "US") return value;
  return "ALL";
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
    metric_price_enabled: String(settings.metricPriceEnabled),
    metric_price_time_kst: settings.metricPriceTimeKst,
    metric_price_market: settings.metricPriceMarket,
    metric_price_limit: String(settings.metricPriceLimit),
    watchlist_skip_recent_hours: String(settings.watchlistSkipRecentHours),
    watchlist_price_enabled: String(settings.watchlistPriceEnabled),
    watchlist_price_time_kst: settings.watchlistPriceTimeKst,
    teacher_watchlist_price_enabled: String(
      settings.teacherWatchlistPriceEnabled
    ),
    teacher_watchlist_price_time_kst: settings.teacherWatchlistPriceTimeKst,
    telegram_enabled: String(settings.telegramEnabled),
    telegram_collect_hours_back: String(settings.telegramCollectHoursBack),
    telegram_message_limit: String(settings.telegramMessageLimit),
    telegram_media_enabled: String(settings.telegramMediaEnabled),
    telegram_media_max_bytes: String(settings.telegramMediaMaxBytes),
    telegram_summary_enabled: String(settings.telegramSummaryEnabled),
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
    metricPriceEnabled: parseBoolean(values.metric_price_enabled, true),
    metricPriceTimeKst: parseTime(values.metric_price_time_kst, "07:00"),
    metricPriceMarket: parseMetricPriceMarket(values.metric_price_market),
    metricPriceLimit: parseInteger(values.metric_price_limit, 0, 0, 10000),
    watchlistSkipRecentHours: parseInteger(
      values.watchlist_skip_recent_hours,
      24,
      0,
      168
    ),
    watchlistPriceEnabled: parseBoolean(values.watchlist_price_enabled, true),
    watchlistPriceTimeKst: parseTime(values.watchlist_price_time_kst, "06:30"),
    teacherWatchlistPriceEnabled: parseBoolean(
      values.teacher_watchlist_price_enabled,
      true
    ),
    teacherWatchlistPriceTimeKst: parseTime(
      values.teacher_watchlist_price_time_kst,
      "06:45"
    ),
    telegramEnabled: parseBoolean(values.telegram_enabled, false),
    telegramCollectHoursBack: parseInteger(
      values.telegram_collect_hours_back,
      2,
      1,
      168
    ),
    telegramMessageLimit: parseInteger(values.telegram_message_limit, 200, 10, 1000),
    telegramMediaEnabled: parseBoolean(values.telegram_media_enabled, true),
    telegramMediaMaxBytes: parseInteger(
      values.telegram_media_max_bytes,
      750000,
      0,
      3000000
    ),
    telegramSummaryEnabled: parseBoolean(values.telegram_summary_enabled, true),
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
       'last_scheduled_run_status',
       'last_watchlist_price_run_date_kst',
       'last_watchlist_price_run_started_at',
       'last_watchlist_price_run_completed_at',
       'last_watchlist_price_run_status',
       'last_watchlist_price_check_reason',
       'last_teacher_watchlist_price_run_date_kst',
       'last_teacher_watchlist_price_run_started_at',
       'last_teacher_watchlist_price_run_completed_at',
       'last_teacher_watchlist_price_run_status',
       'last_teacher_watchlist_price_check_reason',
       'last_metric_price_run_date_kst',
       'last_metric_price_run_started_at',
       'last_metric_price_run_completed_at',
       'last_metric_price_run_status',
       'last_metric_price_check_reason'
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
    lastWatchlistPriceRunDateKst: values.last_watchlist_price_run_date_kst,
    lastWatchlistPriceRunStartedAt: values.last_watchlist_price_run_started_at,
    lastWatchlistPriceRunCompletedAt:
      values.last_watchlist_price_run_completed_at,
    lastWatchlistPriceRunStatus: values.last_watchlist_price_run_status,
    lastWatchlistPriceCheckReason: values.last_watchlist_price_check_reason,
    lastTeacherWatchlistPriceRunDateKst:
      values.last_teacher_watchlist_price_run_date_kst,
    lastTeacherWatchlistPriceRunStartedAt:
      values.last_teacher_watchlist_price_run_started_at,
    lastTeacherWatchlistPriceRunCompletedAt:
      values.last_teacher_watchlist_price_run_completed_at,
    lastTeacherWatchlistPriceRunStatus:
      values.last_teacher_watchlist_price_run_status,
    lastTeacherWatchlistPriceCheckReason:
      values.last_teacher_watchlist_price_check_reason,
    lastMetricPriceRunDateKst: values.last_metric_price_run_date_kst,
    lastMetricPriceRunStartedAt: values.last_metric_price_run_started_at,
    lastMetricPriceRunCompletedAt:
      values.last_metric_price_run_completed_at,
    lastMetricPriceRunStatus: values.last_metric_price_run_status,
    lastMetricPriceCheckReason: values.last_metric_price_check_reason,
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
    metric_price_enabled: String(source.metricPriceEnabled ?? "true"),
    metric_price_time_kst: String(source.metricPriceTimeKst ?? "07:00"),
    metric_price_market: String(source.metricPriceMarket ?? "ALL"),
    metric_price_limit: String(source.metricPriceLimit ?? "0"),
    watchlist_skip_recent_hours: String(source.watchlistSkipRecentHours ?? "24"),
    watchlist_price_enabled: String(source.watchlistPriceEnabled ?? "true"),
    watchlist_price_time_kst: String(source.watchlistPriceTimeKst ?? "06:30"),
    teacher_watchlist_price_enabled: String(
      source.teacherWatchlistPriceEnabled ?? "true"
    ),
    teacher_watchlist_price_time_kst: String(
      source.teacherWatchlistPriceTimeKst ?? "06:45"
    ),
    telegram_enabled: String(source.telegramEnabled ?? "false"),
    telegram_collect_hours_back: String(source.telegramCollectHoursBack ?? "2"),
    telegram_message_limit: String(source.telegramMessageLimit ?? "200"),
    telegram_media_enabled: String(source.telegramMediaEnabled ?? "true"),
    telegram_media_max_bytes: String(source.telegramMediaMaxBytes ?? "750000"),
    telegram_summary_enabled: String(source.telegramSummaryEnabled ?? "true"),
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
