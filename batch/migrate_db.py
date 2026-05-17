import argparse

from db import execute, query_one


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
  "telegram_enabled": "false",
  "telegram_collect_hours_back": "24",
  "telegram_message_limit": "200",
  "telegram_media_enabled": "true",
  "telegram_media_max_bytes": "750000",
  "telegram_summary_enabled": "true",
  "telegram_last_collect_hour_kst": "",
  "last_scheduled_run_date_kst": "",
  "last_scheduler_check_at": "",
  "last_scheduler_check_reason": "",
  "last_scheduled_run_started_at": "",
  "last_scheduled_run_completed_at": "",
  "last_scheduled_run_status": "",
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
    execute(
      f"""INSERT OR IGNORE INTO companies_next
         (code, country, name, market, currency, updated_at)
         SELECT
           code,
           COALESCE({country_expr}, 'KR'),
           name,
           market,
           {currency_expr},
           updated_at
         FROM companies"""
    )
    execute("DROP TABLE companies")

  execute("ALTER TABLE companies_next RENAME TO companies")


def create_metrics_history() -> None:
  sql = table_sql("metrics_history")
  if "PRIMARY KEY (snapshot_date, code, country)" in sql:
    ensure_column("metrics_history", "shares_outstanding", "REAL")
    return

  execute(
    """CREATE TABLE IF NOT EXISTS metrics_history_next (
         snapshot_date     TEXT NOT NULL,
         code              TEXT NOT NULL,
         country           TEXT NOT NULL CHECK(country IN ('KR', 'US')),
         name              TEXT,
         currency          TEXT,
         close_price       REAL,
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
    execute(
      f"""INSERT OR IGNORE INTO metrics_history_next
         (snapshot_date, code, country, name, currency, close_price, market_cap,
          shares_outstanding, equity, net_income, operating_income,
          total_liabilities, debt_ratio, foreign_ratio, institution_ratio,
          per, pbr, roe, report_code, bsns_year, source, created_at)
         SELECT
          snapshot_date, code, COALESCE({country_expr}, 'KR'), name, currency,
          close_price, market_cap, {shares_expr}, equity, net_income,
          operating_income, total_liabilities, debt_ratio, foreign_ratio,
          institution_ratio, per, pbr, roe, report_code, bsns_year, source,
          created_at
         FROM metrics_history"""
    )
    execute("DROP TABLE metrics_history")

  execute("ALTER TABLE metrics_history_next RENAME TO metrics_history")


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


def migrate(clear_legacy_watchlist: bool) -> None:
  execute(
    """CREATE TABLE IF NOT EXISTS app_users (
         id                  TEXT PRIMARY KEY,
         provider            TEXT NOT NULL,
         provider_account_id TEXT NOT NULL,
         name                TEXT,
         email               TEXT,
         image               TEXT,
         created_at          TEXT,
         updated_at          TEXT,
         UNIQUE(provider, provider_account_id)
       )"""
  )
  create_companies()
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
    "CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON user_watchlist(user_id)",
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
