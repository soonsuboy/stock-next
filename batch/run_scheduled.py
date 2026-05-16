import subprocess
import sys
from datetime import datetime, time as datetime_time
from zoneinfo import ZoneInfo

from db import execute

KST = ZoneInfo("Asia/Seoul")
DEFAULTS = {
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
  "last_scheduled_run_date_kst": "",
  "last_scheduler_check_at": "",
  "last_scheduler_check_reason": "",
  "last_scheduled_run_started_at": "",
  "last_scheduled_run_completed_at": "",
  "last_scheduled_run_status": "",
}


def now_text() -> str:
  return datetime.now().isoformat(timespec="seconds")


def bool_setting(settings: dict[str, str], key: str) -> bool:
  return settings.get(key, "").lower() in ["true", "1", "yes", "on"]


def int_setting(settings: dict[str, str], key: str, default: int, min_value: int, max_value: int) -> int:
  try:
    value = int(settings.get(key, str(default)))
  except ValueError:
    return default
  return max(min_value, min(max_value, value))


def load_settings() -> dict[str, str]:
  execute(
    """CREATE TABLE IF NOT EXISTS batch_settings (
         key        TEXT PRIMARY KEY,
         value      TEXT NOT NULL,
         updated_at TEXT
       )"""
  )
  for key, value in DEFAULTS.items():
    execute(
      """INSERT OR IGNORE INTO batch_settings(key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)""",
      [key, value],
    )

  rows = execute("SELECT key, value FROM batch_settings")["rows"]
  settings = DEFAULTS.copy()
  settings.update({str(row["key"]): str(row["value"]) for row in rows})
  return settings


def save_setting(key: str, value: str) -> None:
  execute(
    """INSERT INTO batch_settings(key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at""",
    [key, value],
  )


def should_run_now(settings: dict[str, str], now_kst: datetime) -> tuple[bool, str]:
  if not bool_setting(settings, "schedule_enabled"):
    return False, "schedule disabled"

  time_text = settings.get("schedule_time_kst", "03:00")
  try:
    hour, minute = [int(part) for part in time_text.split(":", 1)]
    target = datetime.combine(now_kst.date(), datetime_time(hour, minute), KST)
  except ValueError:
    target = datetime.combine(now_kst.date(), datetime_time(3, 0), KST)

  window = int_setting(settings, "schedule_window_minutes", 1440, 5, 1440)
  delta_minutes = (now_kst - target).total_seconds() / 60
  if delta_minutes < 0:
    return False, f"before schedule target={target.strftime('%H:%M')}"

  today = now_kst.date().isoformat()
  if settings.get("last_scheduled_run_date_kst") == today:
    return False, f"already ran for {today}"

  if delta_minutes > window:
    return True, (
      f"late schedule execution target={target.strftime('%H:%M')} "
      f"delay={int(delta_minutes)}m window={window}m"
    )

  return True, (
    f"due after schedule target={target.strftime('%H:%M')} "
    f"delay={int(delta_minutes)}m window={window}m"
  )


def run_command(command: list[str]) -> None:
  print("+", " ".join(command), flush=True)
  subprocess.run(command, check=True)


def append_limit(command: list[str], limit: int) -> list[str]:
  if limit > 0:
    return [*command, "--limit", str(limit)]
  return command


def insert_run(status: str, message: str, now_kst: datetime) -> str:
  run_id = f"scheduled-{now_kst.strftime('%Y%m%d')}"
  execute(
    """INSERT INTO batch_runs
       (id, job_name, market, shard_index, shard_count, status, started_at, error_sample)
       VALUES (?, 'scheduled_batch', 'ALL', NULL, NULL, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         started_at = excluded.started_at,
         error_sample = excluded.error_sample""",
    [run_id, status, now_text(), message],
  )
  return run_id


def complete_run(run_id: str, status: str, processed: int, message: str) -> None:
  execute(
    """UPDATE batch_runs
       SET status = ?, completed_at = ?, processed = ?, succeeded = ?,
           failed = ?, error_sample = ?
       WHERE id = ?""",
    [
      status,
      now_text(),
      processed,
      processed if status == "success" else 0,
      0 if status == "success" else 1,
      message,
      run_id,
    ],
  )


def main() -> None:
  settings = load_settings()
  now_kst = datetime.now(KST)
  should_run, reason = should_run_now(settings, now_kst)
  print(f"KST now={now_kst.isoformat(timespec='seconds')} reason={reason}")
  save_setting("last_scheduler_check_at", now_kst.isoformat(timespec="seconds"))
  save_setting("last_scheduler_check_reason", reason)

  if not should_run:
    return

  run_id = insert_run("running", reason, now_kst)
  save_setting("last_scheduled_run_started_at", now_kst.isoformat(timespec="seconds"))
  save_setting("last_scheduled_run_status", "running")
  commands_run = 0

  try:
    weekday = now_kst.isoweekday()
    company_day = int_setting(settings, "company_master_day", 7, 1, 7)
    kr_day = int_setting(settings, "kr_day", 7, 1, 7)
    selection = settings.get("scheduled_selection", "all")
    if selection not in ["all", "missing", "existing"]:
      selection = "all"

    if bool_setting(settings, "company_master_enabled") and weekday == company_day:
      run_command([sys.executable, "batch/update_companies.py", "--market", "ALL"])
      commands_run += 1

    if bool_setting(settings, "kr_enabled") and weekday == kr_day:
      kr_limit = int_setting(settings, "kr_limit", 0, 0, 5000)
      command = [
        sys.executable,
        "batch/update_metrics.py",
        "--market",
        "KR",
        "--selection",
        selection,
      ]
      run_command(append_limit(command, kr_limit))
      commands_run += 1

    if bool_setting(settings, "us_enabled"):
      shard_count = int_setting(settings, "us_shard_count", 7, 1, 31)
      us_limit = int_setting(settings, "us_limit", 1000, 0, 5000)
      shard_index = now_kst.date().toordinal() % shard_count
      command = [
        sys.executable,
        "batch/update_metrics.py",
        "--market",
        "US",
        "--shard-index",
        str(shard_index),
        "--shard-count",
        str(shard_count),
        "--selection",
        selection,
      ]
      run_command(append_limit(command, us_limit))
      commands_run += 1

    save_setting("last_scheduled_run_date_kst", now_kst.date().isoformat())
    save_setting("last_scheduled_run_completed_at", datetime.now(KST).isoformat(timespec="seconds"))
    save_setting("last_scheduled_run_status", "success")
    complete_run(run_id, "success", commands_run, "scheduled batch completed")
  except Exception as error:
    save_setting("last_scheduled_run_completed_at", datetime.now(KST).isoformat(timespec="seconds"))
    save_setting("last_scheduled_run_status", "failed")
    complete_run(run_id, "failed", commands_run, str(error))
    raise


if __name__ == "__main__":
  main()
