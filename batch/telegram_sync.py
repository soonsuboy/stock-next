import argparse
import asyncio
import base64
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import requests
from telethon import TelegramClient
from telethon.sessions import StringSession

from db import execute, execute_many, query_one

KST = ZoneInfo("Asia/Seoul")


def now_text() -> str:
  return datetime.now(KST).isoformat(timespec="seconds")


def today_key() -> str:
  return datetime.now(KST).date().isoformat()


def bool_value(value: str | None, default: bool = False) -> bool:
  if value is None:
    return default
  return value.lower() in ["true", "1", "yes", "on"]


def int_value(value: str | None, default: int, min_value: int, max_value: int) -> int:
  try:
    parsed = int(value or default)
  except (TypeError, ValueError):
    return default
  return max(min_value, min(max_value, parsed))


def load_settings() -> dict[str, str]:
  rows = execute("SELECT key, value FROM batch_settings")["rows"]
  values = {str(row["key"]): str(row["value"]) for row in rows}
  defaults = {
    "telegram_enabled": "false",
    "telegram_collect_hours_back": "2",
    "telegram_message_limit": "200",
    "telegram_media_enabled": "true",
    "telegram_media_max_bytes": "750000",
    "telegram_summary_enabled": "true",
    "telegram_last_collect_hour_kst": "",
  }
  defaults.update(values)
  return defaults


def save_setting(key: str, value: str) -> None:
  execute(
    """INSERT INTO batch_settings(key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at""",
    [key, value],
  )


def telegram_credentials() -> tuple[int, str, str]:
  api_id = os.environ.get("TELEGRAM_API_ID")
  api_hash = os.environ.get("TELEGRAM_API_HASH")
  session = os.environ.get("TELEGRAM_SESSION_STRING")
  if not api_id or not api_hash or not session:
    raise RuntimeError(
      "TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION_STRING are required"
    )
  return int(api_id), api_hash, session


def openai_api_key() -> str:
  return (os.environ.get("OPENAI_API_KEY") or "").strip()


def openai_model() -> str:
  return (os.environ.get("OPENAI_MODEL") or "gpt-4.1-mini").strip()


async def telegram_client() -> TelegramClient:
  api_id, api_hash, session = telegram_credentials()
  client = TelegramClient(StringSession(session), api_id, api_hash)
  await client.connect()
  if not await client.is_user_authorized():
    await client.disconnect()
    raise RuntimeError("Telegram session is not authorized")
  return client


def chat_kind(dialog: Any) -> str:
  if getattr(dialog, "is_channel", False):
    return "channel"
  if getattr(dialog, "is_group", False):
    return "group"
  if getattr(dialog, "is_user", False):
    return "user"
  return "chat"


async def sync_dialogs() -> int:
  client = await telegram_client()
  rows: list[tuple[Any, ...]] = []
  try:
    async for dialog in client.iter_dialogs():
      if dialog.is_user:
        continue
      entity = dialog.entity
      rows.append(
        (
          str(dialog.id),
          dialog.name or str(dialog.id),
          getattr(entity, "username", None),
          chat_kind(dialog),
          now_text(),
        )
      )
  finally:
    await client.disconnect()

  if rows:
    execute_many(
      """INSERT INTO telegram_chats
         (chat_id, title, username, chat_type, enabled, last_message_id, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           title = excluded.title,
           username = excluded.username,
           chat_type = excluded.chat_type,
           enabled = telegram_chats.enabled,
           last_message_id = telegram_chats.last_message_id,
           updated_at = excluded.updated_at""",
      rows,
    )
  return len(rows)


def enabled_chats() -> list[dict[str, Any]]:
  return execute(
    """SELECT chat_id, title, last_message_id
       FROM telegram_chats
       WHERE enabled = 1
       ORDER BY title"""
  )["rows"]


def message_time_keys(value: datetime) -> tuple[str, str, str]:
  if value.tzinfo is None:
    value = value.replace(tzinfo=timezone.utc)
  kst = value.astimezone(KST)
  return (
    kst.isoformat(timespec="seconds"),
    kst.date().isoformat(),
    kst.strftime("%Y-%m-%d %H:00"),
  )


def media_info(message: Any) -> tuple[str | None, str | None]:
  file = getattr(message, "file", None)
  if not file:
    return None, None
  return getattr(file, "mime_type", None), getattr(file, "name", None)


async def maybe_download_media(
  client: TelegramClient,
  message: Any,
  max_bytes: int,
) -> tuple[str | None, int | None]:
  if max_bytes <= 0 or not getattr(message, "media", None):
    return None, None
  data = await client.download_media(message, file=bytes)
  if not data:
    return None, None
  size = len(data)
  if size > max_bytes:
    return None, size
  return base64.b64encode(data).decode("ascii"), size


async def collect_messages(
  hours_back: int,
  limit_per_chat: int,
  media_enabled: bool,
  media_max_bytes: int,
) -> tuple[int, list[str]]:
  chats = enabled_chats()
  if not chats:
    return 0, []

  cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
  client = await telegram_client()
  message_rows: list[tuple[Any, ...]] = []
  media_rows: list[tuple[Any, ...]] = []
  touched_dates: set[str] = set()
  processed = 0

  try:
    for chat in chats:
      chat_id = str(chat["chat_id"])
      last_message_id = int(chat.get("last_message_id") or 0)
      entity = await client.get_entity(int(chat_id))
      max_message_id = last_message_id
      collected: list[Any] = []

      async for message in client.iter_messages(
        entity,
        min_id=last_message_id if last_message_id > 0 else 0,
        limit=limit_per_chat,
      ):
        if not message or not message.id:
          continue
        message_date = message.date
        if message_date and message_date.tzinfo is None:
          message_date = message_date.replace(tzinfo=timezone.utc)
        if last_message_id <= 0 and message_date and message_date < cutoff:
          continue
        collected.append(message)

      for message in reversed(collected):
        message_date, date_key, hour_key = message_time_keys(message.date)
        text = message.message or ""
        has_media = 1 if getattr(message, "media", None) else 0
        sender_name = (
          getattr(message, "post_author", None)
          or (str(message.sender_id) if message.sender_id else None)
        )
        message_rows.append(
          (
            chat_id,
            message.id,
            message_date,
            date_key,
            hour_key,
            sender_name,
            text,
            has_media,
            now_text(),
          )
        )
        touched_dates.add(date_key)
        processed += 1
        max_message_id = max(max_message_id, int(message.id))

        if media_enabled and has_media:
          mime_type, file_name = media_info(message)
          try:
            data_base64, size_bytes = await maybe_download_media(
              client,
              message,
              media_max_bytes,
            )
          except Exception:
            data_base64, size_bytes = None, None
          media_rows.append(
            (
              chat_id,
              message.id,
              0,
              mime_type,
              file_name,
              size_bytes,
              data_base64,
              now_text(),
            )
          )

      if max_message_id > last_message_id:
        execute(
          """UPDATE telegram_chats
             SET last_message_id = ?, updated_at = ?
             WHERE chat_id = ?""",
          [max_message_id, now_text(), chat_id],
        )

      if len(message_rows) >= 300:
        flush_messages(message_rows, media_rows)
        message_rows.clear()
        media_rows.clear()
  finally:
    await client.disconnect()

  flush_messages(message_rows, media_rows)
  return processed, sorted(touched_dates)


def flush_messages(
  message_rows: list[tuple[Any, ...]],
  media_rows: list[tuple[Any, ...]],
) -> None:
  if message_rows:
    execute_many(
      """INSERT INTO telegram_messages
         (chat_id, message_id, message_date, date_key, hour_key, sender_name,
          text, has_media, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chat_id, message_id) DO UPDATE SET
           message_date = excluded.message_date,
           date_key = excluded.date_key,
           hour_key = excluded.hour_key,
           sender_name = excluded.sender_name,
           text = excluded.text,
           has_media = excluded.has_media,
           created_at = excluded.created_at""",
      message_rows,
    )
  if media_rows:
    execute_many(
      """INSERT INTO telegram_media
         (chat_id, message_id, media_index, mime_type, file_name, size_bytes,
          data_base64, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chat_id, message_id, media_index) DO UPDATE SET
           mime_type = excluded.mime_type,
           file_name = excluded.file_name,
           size_bytes = excluded.size_bytes,
           data_base64 = excluded.data_base64,
           created_at = excluded.created_at""",
      media_rows,
    )


def transcript_for(chat_id: str, date_key: str, max_chars: int = 30000) -> str:
  rows = execute(
    """SELECT message_date, sender_name, text, has_media
       FROM telegram_messages
       WHERE chat_id = ? AND date_key = ?
       ORDER BY message_date, message_id
       LIMIT 1000""",
    [chat_id, date_key],
  )["rows"]
  lines = []
  total = 0
  for row in rows:
    media_hint = " [image]" if row.get("has_media") else ""
    text = str(row.get("text") or "").strip()
    if not text and not media_hint:
      continue
    line = f"{row.get('message_date')} {row.get('sender_name') or ''}: {text}{media_hint}"
    total += len(line)
    if total > max_chars:
      lines.append("...(truncated)")
      break
    lines.append(line)
  return "\n".join(lines)


def response_text(data: dict[str, Any]) -> str:
  if isinstance(data.get("output_text"), str):
    return data["output_text"]
  for item in data.get("output") or []:
    for content in item.get("content") or []:
      if isinstance(content, dict) and isinstance(content.get("text"), str):
        return content["text"]
  return ""


def parse_json_text(text: str) -> dict[str, Any]:
  text = text.strip()
  if text.startswith("```"):
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
  return json.loads(text)


def call_openai_summary(transcript: str) -> tuple[dict[str, Any], str]:
  key = openai_api_key()
  if not key:
    raise RuntimeError("OPENAI_API_KEY is not set")
  model = openai_model()
  prompt = (
    "다음 텔레그램 주식 토론방 대화를 읽고 JSON만 반환하세요.\n"
    "형식: {\"summary\":\"날짜별 비고에 들어갈 한국어 요약\","
    "\"positive_stocks\":[{\"name\":\"기업명 또는 티커\",\"reason\":\"긍정 이유\"}],"
    "\"negative_stocks\":[{\"name\":\"기업명 또는 티커\",\"reason\":\"부정 이유\"}],"
    "\"mentioned_stocks\":[{\"name\":\"기업명 또는 티커\",\"sentiment\":\"positive|negative|neutral\",\"reason\":\"근거\"}]}\n"
    "종목이 명확하지 않으면 넣지 마세요.\n\n"
    f"{transcript}"
  )
  response = requests.post(
    "https://api.openai.com/v1/responses",
    headers={
      "Authorization": f"Bearer {key}",
      "Content-Type": "application/json",
    },
    json={
      "model": model,
      "input": [
        {
          "role": "system",
          "content": "You summarize Korean stock chat messages and return strict JSON.",
        },
        {"role": "user", "content": prompt},
      ],
    },
    timeout=60,
  )
  response.raise_for_status()
  parsed = parse_json_text(response_text(response.json()))
  return parsed, model


def normalize_mention(value: Any) -> str:
  if isinstance(value, dict):
    value = value.get("code") or value.get("ticker") or value.get("name") or ""
  return str(value or "").strip()


def resolve_stock(value: Any) -> dict[str, Any] | None:
  term = normalize_mention(value)
  if not term:
    return None
  upper = term.upper().replace(".", "-")
  row = query_one(
    """SELECT code, country, name, market
       FROM companies
       WHERE UPPER(code) = ? OR name LIKE ?
       ORDER BY
         CASE WHEN UPPER(code) = ? THEN 0 ELSE 1 END,
         CASE country WHEN 'KR' THEN 0 ELSE 1 END,
         LENGTH(name)
       LIMIT 1""",
    [upper, f"%{term}%", upper],
  )
  if not row:
    return None
  return {
    "code": row["code"],
    "country": row["country"],
    "name": row["name"],
    "market": row.get("market"),
  }


def enrich_stocks(items: list[Any]) -> list[dict[str, Any]]:
  enriched: list[dict[str, Any]] = []
  seen: set[tuple[str, str]] = set()
  for item in items or []:
    stock = resolve_stock(item)
    reason = item.get("reason") if isinstance(item, dict) else ""
    if not stock:
      continue
    key = (str(stock["country"]), str(stock["code"]))
    if key in seen:
      continue
    seen.add(key)
    stock["reason"] = reason
    enriched.append(stock)
  return enriched


def summarize_chat_date(chat_id: str, date_key: str) -> int:
  transcript = transcript_for(chat_id, date_key)
  if not transcript.strip():
    return 0
  status = "success"
  error = ""
  model = openai_model()
  try:
    summary_data, model = call_openai_summary(transcript)
    summary = str(summary_data.get("summary") or "").strip()
    positive = enrich_stocks(summary_data.get("positive_stocks") or [])
    negative = enrich_stocks(summary_data.get("negative_stocks") or [])
    mentioned = enrich_stocks(summary_data.get("mentioned_stocks") or [])
  except Exception as exc:
    status = "failed"
    error = str(exc)
    summary = "AI 요약을 생성하지 못했습니다. 관리자 환경변수와 배치 로그를 확인하세요."
    positive = []
    negative = []
    mentioned = []

  execute(
    """INSERT INTO telegram_daily_summaries
       (chat_id, summary_date, summary, positive_stocks, negative_stocks,
        mentioned_stocks, model, status, error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chat_id, summary_date) DO UPDATE SET
         summary = excluded.summary,
         positive_stocks = excluded.positive_stocks,
         negative_stocks = excluded.negative_stocks,
         mentioned_stocks = excluded.mentioned_stocks,
         model = excluded.model,
         status = excluded.status,
         error = excluded.error,
         updated_at = excluded.updated_at""",
    [
      chat_id,
      date_key,
      summary,
      json.dumps(positive, ensure_ascii=False),
      json.dumps(negative, ensure_ascii=False),
      json.dumps(mentioned, ensure_ascii=False),
      model,
      status,
      error[:1000],
      now_text(),
    ],
  )
  return 1


def summarize_dates(date_key: str | None = None) -> int:
  if date_key:
    dates = [date_key]
  else:
    dates = [
      str(row["date_key"])
      for row in execute(
        """SELECT DISTINCT date_key
           FROM telegram_messages
           ORDER BY date_key DESC
           LIMIT 2"""
      )["rows"]
    ]
  chats = enabled_chats()
  count = 0
  for chat in chats:
    for item_date in dates:
      count += summarize_chat_date(str(chat["chat_id"]), item_date)
  return count


def start_run(run_id: str, job_name: str, mode: str) -> None:
  execute(
    """INSERT INTO batch_runs
       (id, job_name, market, status, started_at, processed, succeeded, failed)
       VALUES (?, ?, 'TELEGRAM', 'running', ?, 0, 0, 0)
       ON CONFLICT(id) DO UPDATE SET
         job_name = excluded.job_name,
         market = excluded.market,
         status = excluded.status,
         started_at = excluded.started_at,
         completed_at = NULL,
         processed = 0,
         succeeded = 0,
         failed = 0,
         error_sample = ?""",
    [run_id, job_name, now_text(), f"mode={mode}"],
  )


def complete_run(run_id: str, status: str, processed: int, error: str = "") -> None:
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
      error[:1000],
      run_id,
    ],
  )


async def run_mode(args: argparse.Namespace) -> int:
  settings = load_settings()
  if args.mode == "scheduled":
    if not bool_value(settings.get("telegram_enabled"), False):
      print("Telegram sync disabled")
      return 0
    hour_key = datetime.now(KST).strftime("%Y-%m-%d %H")
    if settings.get("telegram_last_collect_hour_kst") == hour_key:
      print(f"Telegram sync already ran for {hour_key}")
      return 0
    processed, dates = await collect_messages(
      int_value(settings.get("telegram_collect_hours_back"), 2, 1, 168),
      int_value(settings.get("telegram_message_limit"), 200, 10, 1000),
      bool_value(settings.get("telegram_media_enabled"), True),
      int_value(settings.get("telegram_media_max_bytes"), 750000, 0, 3000000),
    )
    if bool_value(settings.get("telegram_summary_enabled"), True):
      for date_key in dates or [today_key()]:
        summarize_dates(date_key)
    save_setting("telegram_last_collect_hour_kst", hour_key)
    return processed

  if args.mode == "dialogs":
    return await sync_dialogs()
  if args.mode == "collect":
    processed, dates = await collect_messages(
      args.hours_back,
      args.limit,
      args.media,
      args.media_max_bytes,
    )
    if args.summarize:
      for date_key in dates or [today_key()]:
        summarize_dates(date_key)
    return processed
  if args.mode == "summarize":
    return summarize_dates(args.date or today_key())
  raise RuntimeError(f"Unsupported mode: {args.mode}")


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "--mode",
    choices=["scheduled", "dialogs", "collect", "summarize"],
    required=True,
  )
  parser.add_argument("--date")
  parser.add_argument("--hours-back", type=int, default=2)
  parser.add_argument("--limit", type=int, default=200)
  parser.add_argument("--media", action=argparse.BooleanOptionalAction, default=True)
  parser.add_argument("--media-max-bytes", type=int, default=750000)
  parser.add_argument("--summarize", action="store_true")
  parser.add_argument("--run-id")
  args = parser.parse_args()

  if args.mode == "scheduled" and not bool_value(
    load_settings().get("telegram_enabled"),
    False,
  ):
    print("Telegram sync disabled")
    return

  run_id = args.run_id or str(uuid.uuid4())
  start_run(run_id, "telegram_sync", args.mode)
  try:
    processed = asyncio.run(run_mode(args))
    complete_run(run_id, "success", processed)
    print(f"Done. mode={args.mode}, processed={processed}")
  except Exception as exc:
    complete_run(run_id, "failed", 0, str(exc))
    raise


if __name__ == "__main__":
  main()
