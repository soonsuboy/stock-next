import argparse

from db import execute, query_one
from sector_mapping import infer_gics_sector


DEFAULT_BATCH_SETTINGS = {
  "schedule_enabled": "true",
  "schedule_time_kst": "03:00",
  "schedule_window_minutes": "1440",
  "company_master_enabled": "true",
  "company_master_day": "7",
  "kr_enabled": "true",
  "kr_day": "7",
  "kr_limit": "0",
  "us_enabled": "true",
  "us_limit": "1000",
  "us_shard_count": "7",
  "scheduled_selection": "all",
  "watchlist_skip_recent_hours": "24",
  "watchlist_price_enabled": "true",
  "watchlist_price_time_kst": "06:30",
  "telegram_enabled": "false",
  "telegram_collect_hours_back": "2",
  "telegram_message_limit": "200",
  "telegram_media_enabled": "true",
  "telegram_media_max_bytes": "750000",
  "telegram_summary_enabled": "true",
  "discussion_access_code_hash": "",
  "telegram_last_collect_hour_kst": "",
  "last_scheduled_run_date_kst": "",
  "last_scheduler_check_at": "",
  "last_scheduler_check_reason": "",
  "last_scheduled_run_started_at": "",
  "last_scheduled_run_completed_at": "",
  "last_scheduled_run_status": "",
  "last_watchlist_price_run_date_kst": "",
  "last_watchlist_price_run_started_at": "",
  "last_watchlist_price_run_completed_at": "",
  "last_watchlist_price_run_status": "",
  "last_watchlist_price_check_reason": "",
}


def table_sql(name: str) -> str:
  row = query_one(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name],
  )
  return str(row["sql"]) if row and row.get("sql") else ""


def column_names(name: str) -> set[str]:
  result = execute(f"PRAGMA table_info({name})")
  return {str(row["name"]) for row in result["rows"] if row.get("name")}


def ensure_column(table: str, column: str, definition: str) -> None:
  if column not in column_names(table):
    execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def create_companies() -> None:
  sql = table_sql("companies")
  if "PRIMARY KEY (code, country)" in sql:
    ensure_column("companies", "gics_sector", "TEXT")
    ensure_column("companies", "industry_name", "TEXT")
    ensure_column("companies", "sector_source", "TEXT")
    return

  execute(
    """CREATE TABLE IF NOT EXISTS companies_next (
         code       TEXT NOT NULL,
         country    TEXT NOT NULL CHECK(country IN ('KR', 'US')),
         name       TEXT NOT NULL,
         market     TEXT,
         currency   TEXT,
         corp_code  TEXT,
         cik        TEXT,
         gics_sector TEXT,
         industry_name TEXT,
         sector_source TEXT,
         source     TEXT,
         updated_at TEXT,
         PRIMARY KEY (code, country)
       )"""
  )

  if sql:
    columns = column_names("companies")
    country_expr = "country" if "country" in columns else "'KR'"
    currency_expr = (
      "currency"
      if "currency" in columns
      else f"CASE COALESCE({country_expr}, 'KR') WHEN 'KR' THEN 'KRW' ELSE 'USD' END"
    )
    gics_expr = "gics_sector" if "gics_sector" in columns else "NULL"
    industry_expr = "industry_name" if "industry_name" in columns else "NULL"
    sector_source_expr = "sector_source" if "sector_source" in columns else "NULL"
    execute(
      f"""INSERT OR IGNORE INTO companies_next
         (code, country, name, market, currency, gics_sector, industry_name,
          sector_source, updated_at)
         SELECT
           code,
           COALESCE({country_expr}, 'KR'),
           name,
           market,
           {currency_expr},
           {gics_expr},
           {industry_expr},
           {sector_source_expr},
           updated_at
         FROM companies"""
    )
    execute("DROP TABLE companies")

  execute("ALTER TABLE companies_next RENAME TO companies")


def create_metrics_history() -> None:
  sql = table_sql("metrics_history")
  if "PRIMARY KEY (snapshot_date, code, country)" in sql:
    ensure_column("metrics_history", "shares_outstanding", "REAL")
    ensure_column("metrics_history", "previous_close", "REAL")
    ensure_column("metrics_history", "change_rate", "REAL")
    execute(
      "CREATE INDEX IF NOT EXISTS idx_metrics_history_change_rate ON metrics_history(country, change_rate)"
    )
    return

  execute(
    """CREATE TABLE IF NOT EXISTS metrics_history_next (
         snapshot_date     TEXT NOT NULL,
         code              TEXT NOT NULL,
         country           TEXT NOT NULL CHECK(country IN ('KR', 'US')),
         name              TEXT,
         currency          TEXT,
         close_price       REAL,
         previous_close    REAL,
         change_rate       REAL,
         market_cap        REAL,
         shares_outstanding REAL,
         equity            REAL,
         net_income        REAL,
         operating_income  REAL,
         total_liabilities REAL,
         debt_ratio        REAL,
         foreign_ratio     REAL,
         institution_ratio REAL,
         per               REAL,
         pbr               REAL,
         roe               REAL,
         report_code       TEXT,
         bsns_year         TEXT,
         source            TEXT,
         created_at        TEXT,
         PRIMARY KEY (snapshot_date, code, country)
       )"""
  )

  if sql:
    columns = column_names("metrics_history")
    country_expr = "country" if "country" in columns else "'KR'"
    shares_expr = "shares_outstanding" if "shares_outstanding" in columns else "NULL"
    previous_close_expr = "previous_close" if "previous_close" in columns else "NULL"
    change_rate_expr = "change_rate" if "change_rate" in columns else "NULL"
    execute(
      f"""INSERT OR IGNORE INTO metrics_history_next
         (snapshot_date, code, country, name, currency, close_price,
          previous_close, change_rate, market_cap, shares_outstanding, equity,
          net_income, operating_income,
          total_liabilities, debt_ratio, foreign_ratio, institution_ratio,
          per, pbr, roe, report_code, bsns_year, source, created_at)
         SELECT
          snapshot_date, code, COALESCE({country_expr}, 'KR'), name, currency,
          close_price, {previous_close_expr}, {change_rate_expr}, market_cap,
          {shares_expr}, equity, net_income,
          operating_income, total_liabilities, debt_ratio, foreign_ratio,
          institution_ratio, per, pbr, roe, report_code, bsns_year, source,
          created_at
         FROM metrics_history"""
    )
    execute("DROP TABLE metrics_history")

  execute("ALTER TABLE metrics_history_next RENAME TO metrics_history")
  execute(
    "CREATE INDEX IF NOT EXISTS idx_metrics_history_change_rate ON metrics_history(country, change_rate)"
  )


def create_batch_settings() -> None:
  execute(
    """CREATE TABLE IF NOT EXISTS batch_settings (
         key        TEXT PRIMARY KEY,
         value      TEXT NOT NULL,
         updated_at TEXT
       )"""
  )

  for key, value in DEFAULT_BATCH_SETTINGS.items():
    execute(
      """INSERT OR IGNORE INTO batch_settings(key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)""",
      [key, value],
    )


def backfill_company_sectors() -> None:
  result = execute(
    """SELECT code, country, name, market, industry_name
       FROM companies
       WHERE gics_sector IS NULL OR gics_sector = ''"""
  )
  rows = []
  for row in result["rows"]:
    sector, source = infer_gics_sector(
      code=str(row.get("code") or ""),
      country=str(row.get("country") or ""),
      name=str(row.get("name") or ""),
      market=str(row.get("market") or ""),
      industry_name=str(row.get("industry_name") or ""),
    )
    if sector:
      rows.append((sector, source, row.get("code"), row.get("country")))

  if rows:
    from db import execute_many

    execute_many(
      """UPDATE companies
         SET gics_sector = ?, sector_source = COALESCE(?, sector_source)
         WHERE code = ? AND country = ?
           AND (gics_sector IS NULL OR gics_sector = '')""",
      rows,
    )


def migrate(clear_legacy_watchlist: bool) -> None:
  execute(
    """CREATE TABLE IF NOT EXISTS app_users (
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
       )"""
  )
  ensure_column("app_users", "active", "INTEGER NOT NULL DEFAULT 1")
  ensure_column("app_users", "disabled_at", "TEXT")
  ensure_column("app_users", "last_login_at", "TEXT")
  create_companies()
  execute(
    """CREATE TABLE IF NOT EXISTS index_memberships (
         index_code TEXT NOT NULL,
         code       TEXT NOT NULL,
         country    TEXT NOT NULL CHECK(country IN ('KR', 'US')),
         name       TEXT,
         gics_sector TEXT,
         source     TEXT,
         updated_at TEXT,
         PRIMARY KEY(index_code, code, country)
       )"""
  )
  execute(
    "CREATE INDEX IF NOT EXISTS idx_index_memberships_market ON index_memberships(index_code, country)"
  )
  backfill_company_sectors()
  create_metrics_history()
  create_batch_settings()
  execute(
    """CREATE TABLE IF NOT EXISTS corp_codes (
         stock_code TEXT PRIMARY KEY,
         corp_code  TEXT NOT NULL,
         corp_name  TEXT,
         updated_at TEXT
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS user_watchlist (
         id         INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id    TEXT NOT NULL,
         code       TEXT NOT NULL,
         country    TEXT NOT NULL CHECK(country IN ('KR', 'US')),
         added_at   TEXT DEFAULT CURRENT_TIMESTAMP,
         updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(user_id, code, country),
         FOREIGN KEY(user_id) REFERENCES app_users(id),
         FOREIGN KEY(code, country) REFERENCES companies(code, country)
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS user_discussion_access (
         user_id    TEXT PRIMARY KEY,
         code_id    INTEGER,
         code_hash  TEXT,
         granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
         expires_at TEXT,
         FOREIGN KEY(user_id) REFERENCES app_users(id)
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS discussion_access_codes (
         id            INTEGER PRIMARY KEY AUTOINCREMENT,
         label         TEXT NOT NULL,
         code_hash     TEXT NOT NULL UNIQUE,
         duration_days INTEGER NOT NULL,
         active        INTEGER DEFAULT 1,
         created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
         updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
       )"""
  )
  ensure_column("user_discussion_access", "code_id", "INTEGER")
  ensure_column("user_discussion_access", "code_hash", "TEXT")
  ensure_column("user_discussion_access", "expires_at", "TEXT")
  legacy_code = query_one(
    "SELECT value FROM batch_settings WHERE key = 'discussion_access_code_hash'"
  )
  legacy_hash = str(legacy_code["value"]) if legacy_code and legacy_code.get("value") else ""
  if legacy_hash:
    execute(
      """INSERT OR IGNORE INTO discussion_access_codes
         (label, code_hash, duration_days, active, created_at, updated_at)
         VALUES ('기존 코드', ?, 365, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
      [legacy_hash],
    )
    execute(
      """UPDATE user_discussion_access
         SET code_id = (
               SELECT id
               FROM discussion_access_codes
               WHERE code_hash = ?
               LIMIT 1
             ),
             expires_at = COALESCE(expires_at, datetime('now', '+365 days'))
         WHERE code_hash = ?""",
      [legacy_hash, legacy_hash],
    )
  execute(
    """CREATE TABLE IF NOT EXISTS batch_runs (
         id          TEXT PRIMARY KEY,
         job_name    TEXT NOT NULL,
         market      TEXT,
         shard_index INTEGER,
         shard_count INTEGER,
         status      TEXT NOT NULL,
         started_at  TEXT,
         completed_at TEXT,
         processed   INTEGER DEFAULT 0,
         succeeded   INTEGER DEFAULT 0,
         failed      INTEGER DEFAULT 0,
         error_sample TEXT
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS batch_run_items (
         run_id     TEXT NOT NULL,
         code       TEXT NOT NULL,
         country    TEXT NOT NULL,
         status     TEXT NOT NULL,
         error      TEXT,
         created_at TEXT DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY(run_id, code, country)
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS telegram_chats (
         chat_id         TEXT PRIMARY KEY,
         title           TEXT NOT NULL,
         username        TEXT,
         chat_type       TEXT,
         enabled         INTEGER DEFAULT 0,
         last_message_id INTEGER DEFAULT 0,
         updated_at      TEXT
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS telegram_messages (
         chat_id      TEXT NOT NULL,
         message_id   INTEGER NOT NULL,
         message_date TEXT NOT NULL,
         date_key     TEXT NOT NULL,
         hour_key     TEXT NOT NULL,
         sender_name  TEXT,
         text         TEXT,
         has_media    INTEGER DEFAULT 0,
         created_at   TEXT,
         PRIMARY KEY(chat_id, message_id),
         FOREIGN KEY(chat_id) REFERENCES telegram_chats(chat_id)
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS telegram_media (
         chat_id     TEXT NOT NULL,
         message_id  INTEGER NOT NULL,
         media_index INTEGER NOT NULL,
         mime_type   TEXT,
         file_name   TEXT,
         size_bytes  INTEGER,
         data_base64 TEXT,
         created_at  TEXT,
         PRIMARY KEY(chat_id, message_id, media_index)
       )"""
  )
  execute(
    """CREATE TABLE IF NOT EXISTS telegram_daily_summaries (
         chat_id          TEXT NOT NULL,
         summary_date     TEXT NOT NULL,
         summary          TEXT,
         positive_stocks  TEXT,
         negative_stocks  TEXT,
         mentioned_stocks TEXT,
         model            TEXT,
         status           TEXT,
         error            TEXT,
         updated_at       TEXT,
         PRIMARY KEY(chat_id, summary_date)
       )"""
  )

  for statement in [
    "CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)",
    "CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country)",
    "CREATE INDEX IF NOT EXISTS idx_companies_gics_sector ON companies(gics_sector)",
    "CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON user_watchlist(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_discussion_access_granted ON user_discussion_access(granted_at)",
    "CREATE INDEX IF NOT EXISTS idx_user_discussion_access_expires ON user_discussion_access(expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_discussion_access_codes_active ON discussion_access_codes(active)",
    "CREATE INDEX IF NOT EXISTS idx_metrics_code_country ON metrics_history(code, country)",
    "CREATE INDEX IF NOT EXISTS idx_metrics_snapshot ON metrics_history(snapshot_date)",
    "CREATE INDEX IF NOT EXISTS idx_metrics_country_code_snapshot ON metrics_history(country, code, snapshot_date)",
    "CREATE INDEX IF NOT EXISTS idx_metrics_country_snapshot ON metrics_history(country, snapshot_date)",
    "CREATE INDEX IF NOT EXISTS idx_batch_runs_started ON batch_runs(started_at)",
    "CREATE INDEX IF NOT EXISTS idx_batch_runs_completed ON batch_runs(completed_at)",
    "CREATE INDEX IF NOT EXISTS idx_batch_items_run ON batch_run_items(run_id)",
    "CREATE INDEX IF NOT EXISTS idx_telegram_chats_enabled ON telegram_chats(enabled)",
    "CREATE INDEX IF NOT EXISTS idx_telegram_messages_date ON telegram_messages(date_key, chat_id)",
    "CREATE INDEX IF NOT EXISTS idx_telegram_messages_hour ON telegram_messages(hour_key, chat_id)",
    "CREATE INDEX IF NOT EXISTS idx_telegram_media_message ON telegram_media(chat_id, message_id)",
    "CREATE INDEX IF NOT EXISTS idx_telegram_summaries_date ON telegram_daily_summaries(summary_date)",
  ]:
    execute(statement)

  if clear_legacy_watchlist:
    if table_sql("financials"):
      execute("DELETE FROM financials")
    if table_sql("watchlist"):
      execute("DELETE FROM watchlist")


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--clear-legacy-watchlist", action="store_true")
  args = parser.parse_args()
  migrate(clear_legacy_watchlist=args.clear_legacy_watchlist)
  print("DB migration completed")
