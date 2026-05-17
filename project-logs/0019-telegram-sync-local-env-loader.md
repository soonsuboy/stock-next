# 0019 Telegram Sync Local Env Loader

## Request
- User asked to test Telegram/OpenAI setup after adding values locally.
- Local inspection showed `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` were present, but direct Python scripts still need local `.env.local` loading support for smooth tests.

## Implementation
- Updated `batch/telegram_sync.py`.
- Added the same repo-root `.env.local` loader pattern used by `batch/telegram_login.py`.
- `main()` now loads `.env.local` before reading Telegram/OpenAI environment variables.

## Modified Files
- `batch/telegram_sync.py`
- `project-logs/0019-telegram-sync-local-env-loader.md`

## Verification
- `python -m compileall batch/telegram_sync.py`
- Local env loader check:
  - `TELEGRAM_API_ID_LOADED=True`
  - `TELEGRAM_API_HASH_LOADED=True`
  - `TELEGRAM_SESSION_STRING_LOADED=True`
  - `OPENAI_API_KEY_LOADED=True`
- `python batch/telegram_sync.py --mode dialogs`
  - Succeeded.
  - Saved 7 Telegram chats to `telegram_chats`.
- `python batch/telegram_sync.py --mode collect --hours-back 1 --limit 5 --no-media`
  - Succeeded with `processed=0` because no Telegram chats are enabled yet.
- OpenAI smoke test with a dummy transcript reached the Responses API but returned HTTP `429 Too Many Requests`.
  - This means the key is being sent, but the OpenAI account/key currently cannot complete the request because of rate limit/quota/billing constraints.

## Handoff
- Required local keys for full test:
  - `TELEGRAM_API_ID`
  - `TELEGRAM_API_HASH`
  - `TELEGRAM_SESSION_STRING`
  - `OPENAI_API_KEY`
- Next manual step:
  - Enable one or more chats from the admin page, then rerun collection.
  - Check OpenAI billing/usage limits before expecting AI summaries to succeed.
