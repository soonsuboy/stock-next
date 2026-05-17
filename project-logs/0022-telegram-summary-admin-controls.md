# 0022 Telegram Summary Admin Controls

## Request
- Clarify when new Telegram messages are reflected.
- Change normal Telegram collection to a 2-hour lookback instead of the previous 24-hour lookback.
- OpenAI billing was unavailable, so failed AI summaries need a way to be retried later.
- Add admin controls by collected date:
  - Retry AI summary.
  - Find most-mentioned positive and negative stocks for that day.
  - Find most-mentioned positive and negative stocks for the last week.

## Behavior Notes
- GitHub Actions wakes every 15 minutes.
- `batch/telegram_sync.py --mode scheduled` still skips repeated runs in the same KST hour, so new Telegram messages usually reflect within the next hourly scheduled sync.
- The message lookback window is now set to 2 hours for normal operation.
- If older messages/images must be recovered, temporarily increase the lookback window in Admin and use the existing backfill controls.

## Implementation
- Changed Telegram lookback defaults from 24 hours to 2 hours:
  - `lib/batch-settings.ts`
  - `batch/migrate_db.py`
  - `batch/telegram_sync.py`
- Updated the live Turso `batch_settings.telegram_collect_hours_back` value to `2`.
- Added `GET /api/admin/telegram/summaries`:
  - Returns collected dates from enabled Telegram chats.
  - Includes message count, chat count, summary success/failed/pending counts, and recent timestamps.
- Added `GET /api/admin/telegram/rankings`:
  - Accepts `date=YYYY-MM-DD` and `period=day|week`.
  - Aggregates successful `telegram_daily_summaries`.
  - Ranks positive and negative stocks from both direct positive/negative lists and matching `mentioned_stocks` sentiment.
- Extended Admin Telegram section:
  - Shows collected date rows.
  - Adds per-date `요약 재시도`, `당일 랭킹`, and `1주 랭킹` buttons.
  - Shows positive/negative ranking results inline.
- Extended Telegram trigger request logging to include requested summary date.

## Modified Files
- `app/admin/AdminDashboard.tsx`
- `app/api/admin/telegram/rankings/route.ts`
- `app/api/admin/telegram/summaries/route.ts`
- `app/api/admin/telegram/trigger/route.ts`
- `batch/migrate_db.py`
- `batch/telegram_sync.py`
- `lib/batch-settings.ts`
- `project-logs/0022-telegram-summary-admin-controls.md`

## Verification
- `python -m compileall batch/telegram_sync.py batch/migrate_db.py`
- `npm run lint`
- `npm run build`
- Confirmed live DB setting:
  - `telegram_collect_hours_back = 2`

## Handoff
- After OpenAI billing is fixed, go to Admin > 텔레그램 종목 토론 설정 > 수집 날짜별 요약 관리.
- Use `요약 재시도` on failed or pending dates.
- Use `당일 랭킹` or `1주 랭킹` after successful summaries exist.
- Ranking is based on AI summary output, so it will be empty until summaries succeed.
