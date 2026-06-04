import subprocess
import sys
from datetime import datetime, time as datetime_time
from zoneinfo import ZoneInfo

from db import execute

KST = ZoneInfo("Asia/Seoul")
OUTPUT_TAIL_LIMIT = 3000
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
  "metric_price_enabled": "true",
  "metric_price_time_kst": "07:00",
  "metric_price_market": "ALL",
  "metric_price_limit": "0",
  "watchlist_price_enabled": "true",
  "watchlist_price_time_kst": "06:30",
  "teacher_watchlist_price_enabled": "true",
  "teacher_watchlist_price_time_kst": "06:45",
  "macro_indicator_enabled": "true",
  "macro_indicator_time_kst": "08:00",
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
  "last_teacher_watchlist_price_run_date_kst": "",
  "last_teacher_watchlist_price_run_started_at": "",
  "last_teacher_watchlist_price_run_completed_at": "",
  "last_teacher_watchlist_price_run_status": "",
  "last_teacher_watchlist_price_check_reason": "",
  "last_macro_indicator_run_date_kst": "",
  "last_macro_indicator_run_started_at": "",
  "last_macro_indicator_run_completed_at": "",
  "last_macro_indicator_run_status": "",
  "last_macro_indicator_check_reason": "",
  "last_metric_price_run_date_kst": "",
  "last_metric_price_run_started_at": "",
  "last_metric_price_run_completed_at": "",
  "last_metric_price_run_status": "",
  "last_metric_price_check_reason": "",
}


def now_text() -> str:
  return datetime.now(KST).isoformat(timespec="seconds")


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
    return False, (
      f"missed schedule window target={target.strftime('%H:%M')} "
      f"delay={int(delta_minutes)}m window={window}m"
    )

  return True, (
    f"due after schedule target={target.strftime('%H:%M')} "
    f"delay={int(delta_minutes)}m window={window}m"
  )


def should_run_watchlist_price_now(
  settings: dict[str, str], now_kst: datetime
) -> tuple[bool, str]:
  if not bool_setting(settings, "watchlist_price_enabled"):
    return False, "watchlist price schedule disabled"

  time_text = settings.get("watchlist_price_time_kst", "06:30")
  try:
    hour, minute = [int(part) for part in time_text.split(":", 1)]
    target = datetime.combine(now_kst.date(), datetime_time(hour, minute), KST)
  except ValueError:
    target = datetime.combine(now_kst.date(), datetime_time(6, 30), KST)

  delta_minutes = (now_kst - target).total_seconds() / 60
  if delta_minutes < 0:
    return False, f"before watchlist price target={target.strftime('%H:%M')}"

  today = now_kst.date().isoformat()
  if settings.get("last_watchlist_price_run_date_kst") == today:
    return False, f"watchlist prices already ran for {today}"

  return True, (
    f"watchlist price due target={target.strftime('%H:%M')} "
    f"delay={int(delta_minutes)}m"
  )


def should_run_metric_price_now(
  settings: dict[str, str], now_kst: datetime
) -> tuple[bool, str]:
  if not bool_setting(settings, "metric_price_enabled"):
    return False, "metric price schedule disabled"

  time_text = settings.get("metric_price_time_kst", "07:00")
  try:
    hour, minute = [int(part) for part in time_text.split(":", 1)]
    target = datetime.combine(now_kst.date(), datetime_time(hour, minute), KST)
  except ValueError:
    target = datetime.combine(now_kst.date(), datetime_time(7, 0), KST)

  delta_minutes = (now_kst - target).total_seconds() / 60
  if delta_minutes < 0:
    return False, f"before metric price target={target.strftime('%H:%M')}"

  today = now_kst.date().isoformat()
  if settings.get("last_metric_price_run_date_kst") == today:
    return False, f"metric prices already ran for {today}"

  return True, (
    f"metric price due target={target.strftime('%H:%M')} "
    f"delay={int(delta_minutes)}m"
  )


def should_run_teacher_watchlist_price_now(
  settings: dict[str, str], now_kst: datetime
) -> tuple[bool, str]:
  if not bool_setting(settings, "teacher_watchlist_price_enabled"):
    return False, "teacher watchlist price schedule disabled"

  time_text = settings.get("teacher_watchlist_price_time_kst", "06:45")
  try:
    hour, minute = [int(part) for part in time_text.split(":", 1)]
    target = datetime.combine(now_kst.date(), datetime_time(hour, minute), KST)
  except ValueError:
    target = datetime.combine(now_kst.date(), datetime_time(6, 45), KST)

  delta_minutes = (now_kst - target).total_seconds() / 60
  if delta_minutes < 0:
    return False, f"before teacher watchlist price target={target.strftime('%H:%M')}"

  today = now_kst.date().isoformat()
  if settings.get("last_teacher_watchlist_price_run_date_kst") == today:
    return False, f"teacher watchlist prices already ran for {today}"

  return True, (
    f"teacher watchlist price due target={target.strftime('%H:%M')} "
    f"delay={int(delta_minutes)}m"
  )


def should_run_macro_indicator_now(
  settings: dict[str, str], now_kst: datetime
) -> tuple[bool, str]:
  if not bool_setting(settings, "macro_indicator_enabled"):
    return False, "macro indicator schedule disabled"

  time_text = settings.get("macro_indicator_time_kst", "08:00")
  try:
    hour, minute = [int(part) for part in time_text.split(":", 1)]
    target = datetime.combine(now_kst.date(), datetime_time(hour, minute), KST)
  except ValueError:
    target = datetime.combine(now_kst.date(), datetime_time(8, 0), KST)

  delta_minutes = (now_kst - target).total_seconds() / 60
  if delta_minutes < 0:
    return False, f"before macro indicator target={target.strftime('%H:%M')}"

  today = now_kst.date().isoformat()
  if settings.get("last_macro_indicator_run_date_kst") == today:
    return False, f"macro indicators already ran for {today}"

  return True, (
    f"macro indicator due target={target.strftime('%H:%M')} "
    f"delay={int(delta_minutes)}m"
  )


def tail_text(value: str) -> str:
  text = value.strip()
  if len(text) <= OUTPUT_TAIL_LIMIT:
    return text
  return text[-OUTPUT_TAIL_LIMIT:]


def run_command(command: list[str]) -> None:
  print("+", " ".join(command), flush=True)
  result = subprocess.run(command, check=False, capture_output=True, text=True)
  if result.stdout:
    print(result.stdout, end="" if result.stdout.endswith("\n") else "\n", flush=True)
  if result.stderr:
    print(result.stderr, end="" if result.stderr.endswith("\n") else "\n", flush=True)
  if result.returncode != 0:
    details = "\n".join(
      part
      for part in [
        f"command={' '.join(command)}",
        f"exit_code={result.returncode}",
        f"stdout={tail_text(result.stdout)}" if result.stdout else "",
        f"stderr={tail_text(result.stderr)}" if result.stderr else "",
      ]
      if part
    )
    raise RuntimeError(details)


def append_limit(command: list[str], limit: int) -> list[str]:
  if limit > 0:
    return [*command, "--limit", str(limit)]
  return command


def insert_run(status: str, message: str, now_kst: datetime) -> str:
  run_id = f"scheduled-{now_kst.strftime('%Y%m%d-%H%M%S')}"
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


def complete_run(
  run_id: str,
  status: str,
  processed: int,
  succeeded: int,
  failed: int,
  message: str,
) -> None:
  execute(
    """UPDATE batch_runs
       SET status = ?, completed_at = ?, processed = ?, succeeded = ?,
           failed = ?, error_sample = ?
       WHERE id = ?""",
    [
      status,
      now_text(),
      processed,
      succeeded,
      failed,
      message,
      run_id,
    ],
  )


def run_scheduled_command(command: list[str], errors: list[str]) -> bool:
  try:
    run_command(command)
    return True
  except Exception as error:
    message = str(error)
    errors.append(message)
    print(f"[scheduled command failed]\n{message}", flush=True)
    return False


def run_watchlist_price_schedule(settings: dict[str, str], now_kst: datetime) -> None:
  should_run, reason = should_run_watchlist_price_now(settings, now_kst)
  print(f"watchlist price reason={reason}")
  save_setting("last_watchlist_price_check_reason", reason)
  if not should_run:
    return

  run_id = f"watchlist-price-{now_kst.strftime('%Y%m%d')}"
  save_setting(
    "last_watchlist_price_run_started_at",
    now_kst.isoformat(timespec="seconds"),
  )
  save_setting("last_watchlist_price_run_status", "running")
  try:
    run_command(
      [
        sys.executable,
        "batch/update_watchlist_prices.py",
        "--market",
        "ALL",
        "--run-id",
        run_id,
      ]
    )
    save_setting("last_watchlist_price_run_date_kst", now_kst.date().isoformat())
    save_setting(
      "last_watchlist_price_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_watchlist_price_run_status", "success")
  except Exception as error:
    print(f"[watchlist price schedule failed] {error}", flush=True)
    save_setting(
      "last_watchlist_price_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_watchlist_price_run_status", "failed")


def run_metric_price_schedule(settings: dict[str, str], now_kst: datetime) -> None:
  should_run, reason = should_run_metric_price_now(settings, now_kst)
  print(f"metric price reason={reason}")
  save_setting("last_metric_price_check_reason", reason)
  if not should_run:
    return

  run_id = f"metric-price-{now_kst.strftime('%Y%m%d')}"
  market = settings.get("metric_price_market", "ALL")
  if market not in ["ALL", "KR", "US"]:
    market = "ALL"
  limit = int_setting(settings, "metric_price_limit", 0, 0, 10000)
  command = [
    sys.executable,
    "batch/update_watchlist_prices.py",
    "--scope",
    "metrics",
    "--market",
    market,
    "--run-id",
    run_id,
  ]
  command = append_limit(command, limit)

  save_setting(
    "last_metric_price_run_started_at",
    now_kst.isoformat(timespec="seconds"),
  )
  save_setting("last_metric_price_run_status", "running")
  try:
    run_command(command)
    save_setting("last_metric_price_run_date_kst", now_kst.date().isoformat())
    save_setting(
      "last_metric_price_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_metric_price_run_status", "success")
  except Exception as error:
    print(f"[metric price schedule failed] {error}", flush=True)
    save_setting(
      "last_metric_price_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_metric_price_run_status", "failed")


def run_teacher_watchlist_price_schedule(
  settings: dict[str, str],
  now_kst: datetime,
) -> None:
  should_run, reason = should_run_teacher_watchlist_price_now(settings, now_kst)
  print(f"teacher watchlist price reason={reason}")
  save_setting("last_teacher_watchlist_price_check_reason", reason)
  if not should_run:
    return

  run_id = f"teacher-watchlist-price-{now_kst.strftime('%Y%m%d')}"
  save_setting(
    "last_teacher_watchlist_price_run_started_at",
    now_kst.isoformat(timespec="seconds"),
  )
  save_setting("last_teacher_watchlist_price_run_status", "running")
  try:
    run_command(
      [
        sys.executable,
        "batch/update_watchlist_prices.py",
        "--scope",
        "teacher",
        "--market",
        "ALL",
        "--run-id",
        run_id,
      ]
    )
    save_setting(
      "last_teacher_watchlist_price_run_date_kst",
      now_kst.date().isoformat(),
    )
    save_setting(
      "last_teacher_watchlist_price_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_teacher_watchlist_price_run_status", "success")
  except Exception as error:
    print(f"[teacher watchlist price schedule failed] {error}", flush=True)
    save_setting(
      "last_teacher_watchlist_price_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_teacher_watchlist_price_run_status", "failed")


def run_macro_indicator_schedule(settings: dict[str, str], now_kst: datetime) -> None:
  should_run, reason = should_run_macro_indicator_now(settings, now_kst)
  print(f"macro indicator reason={reason}")
  save_setting("last_macro_indicator_check_reason", reason)
  if not should_run:
    return

  save_setting(
    "last_macro_indicator_run_started_at",
    now_kst.isoformat(timespec="seconds"),
  )
  save_setting("last_macro_indicator_run_status", "running")
  try:
    run_command([sys.executable, "batch/update_macro_indicators.py"])
    save_setting("last_macro_indicator_run_date_kst", now_kst.date().isoformat())
    save_setting(
      "last_macro_indicator_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_macro_indicator_run_status", "success")
  except Exception as error:
    print(f"[macro indicator schedule failed] {error}", flush=True)
    save_setting(
      "last_macro_indicator_run_completed_at",
      datetime.now(KST).isoformat(timespec="seconds"),
    )
    save_setting("last_macro_indicator_run_status", "failed")


def main() -> None:
  settings = load_settings()
  now_kst = datetime.now(KST)
  should_run, reason = should_run_now(settings, now_kst)
  print(f"KST now={now_kst.isoformat(timespec='seconds')} reason={reason}")
  save_setting("last_scheduler_check_at", now_kst.isoformat(timespec="seconds"))
  save_setting("last_scheduler_check_reason", reason)
  run_watchlist_price_schedule(settings, now_kst)
  run_teacher_watchlist_price_schedule(settings, now_kst)
  run_macro_indicator_schedule(settings, now_kst)
  run_metric_price_schedule(settings, now_kst)

  if not should_run:
    return

  run_id = insert_run("running", reason, now_kst)
  save_setting("last_scheduled_run_started_at", now_kst.isoformat(timespec="seconds"))
  save_setting("last_scheduled_run_status", "running")
  processed = 0
  succeeded = 0
  failed = 0
  errors: list[str] = []

  weekday = now_kst.isoweekday()
  company_day = int_setting(settings, "company_master_day", 7, 1, 7)
  kr_day = int_setting(settings, "kr_day", 7, 1, 7)
  selection = settings.get("scheduled_selection", "all")
  if selection not in ["all", "missing", "existing"]:
    selection = "all"

  def run_and_count(command: list[str]) -> None:
    nonlocal processed, succeeded, failed
    processed += 1
    if run_scheduled_command(command, errors):
      succeeded += 1
    else:
      failed += 1

  if bool_setting(settings, "company_master_enabled") and weekday == company_day:
    run_and_count([sys.executable, "batch/update_companies.py", "--market", "ALL"])

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
    run_and_count(append_limit(command, kr_limit))

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
    run_and_count(append_limit(command, us_limit))

  status = "success" if failed == 0 else "partial" if succeeded > 0 else "failed"
  message = "scheduled batch completed" if not errors else "\n\n".join(errors[:10])
  save_setting("last_scheduled_run_date_kst", now_kst.date().isoformat())
  save_setting(
    "last_scheduled_run_completed_at",
    datetime.now(KST).isoformat(timespec="seconds"),
  )
  save_setting("last_scheduled_run_status", status)
  complete_run(run_id, status, processed, succeeded, failed, message)


if __name__ == "__main__":
  main()
