import os

from telethon.sync import TelegramClient
from telethon.sessions import StringSession


def main() -> None:
  api_id = os.environ.get("TELEGRAM_API_ID")
  api_hash = os.environ.get("TELEGRAM_API_HASH")
  if not api_id or not api_hash:
    raise RuntimeError("Set TELEGRAM_API_ID and TELEGRAM_API_HASH first")

  with TelegramClient(StringSession(), int(api_id), api_hash) as client:
    print("Login in the browser/terminal flow, then store this as TELEGRAM_SESSION_STRING:")
    print(client.session.save())


if __name__ == "__main__":
  main()
