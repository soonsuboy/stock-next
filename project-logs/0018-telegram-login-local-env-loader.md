# 0018 Telegram Login Local Env Loader

## Request
- User added `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` to `.env.local`.
- Running `python batch/telegram_login.py` still failed because Python did not automatically load `.env.local`.

## Implementation
- Updated `batch/telegram_login.py`.
- Added `load_local_env()`:
  - Reads repo-root `.env.local`.
  - Ignores comments and blank lines.
  - Loads `KEY=value` pairs into `os.environ` only when the variable is not already set.
- `main()` now calls `load_local_env()` before reading Telegram credentials.

## Modified Files
- `batch/telegram_login.py`
- `project-logs/0018-telegram-login-local-env-loader.md`

## Verification
- Verified the loader can see both `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` without printing their values.

## Handoff
- Running `python batch/telegram_login.py` from the repo root should now start the Telegram login flow using `.env.local`.
- The script may prompt for phone, login code, and 2FA password depending on the Telegram account.
