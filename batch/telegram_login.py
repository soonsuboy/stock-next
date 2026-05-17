import os
from pathlib import Path

from telethon.sync import TelegramClient
from telethon.sessions import StringSession


def load_local_env() -> None:
  env_path = Path(__file__).resolve().parents[1] / ".env.local"
  if not env_path.exists():
    return

  for line in env_path.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
      continue
    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip().strip('"').strip("'")
    if key and key not in os.environ:
      os.environ[key] = value


def main() -> None:
  load_local_env()
  api_id = os.environ.get("TELEGRAM_API_ID")
  api_hash = os.environ.get("TELEGRAM_API_HASH")
  if not api_id or not api_hash:
    raise RuntimeError("Set TELEGRAM_API_ID and TELEGRAM_API_HASH first")

  with TelegramClient(StringSession(), int(api_id), api_hash) as client:
    print("Login in the browser/terminal flow, then store this as TELEGRAM_SESSION_STRING:")
    print(client.session.save())


if __name__ == "__main__":
  main()
