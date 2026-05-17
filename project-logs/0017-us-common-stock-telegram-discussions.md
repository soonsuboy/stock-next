# 0017 US Common Stock Filter and Telegram Discussions

## Request
- Only aggregate US stocks whose listing is Common Stock.
- Add a new top navigation menu: `종목 토론`.
- Let the admin choose from Telegram chat rooms the user participates in.
- Collect Telegram messages and images hourly according to admin settings.
- Show collected chat content by date and hour.
- Use AI to summarize daily conversations, show positive/negative stocks, and allow triggering financial batch collection for those stocks.

## Plan
1. Restrict US company master and US metrics aggregation to `Common Stock`.
2. Add Telegram storage tables for chats, messages, media, and daily summaries.
3. Add a Telegram user-session batch script based on Telegram API credentials.
4. Add GitHub Actions modes for Telegram dialog refresh, collection, and summarization.
5. Add admin UI/API for Telegram settings and chat selection.
6. Add discussion UI/API for date-based browsing, images, summaries, sentiment stock lists, and metrics trigger buttons.

## Implementation
- US Common Stock filtering:
  - `batch/update_companies.py` now stores only US rows whose security name contains `Common Stock`.
  - `batch/update_metrics.py` also filters US metric collection to `Common Stock`, so old non-common rows left in `companies` are not aggregated.
- Telegram schema:
  - `telegram_chats`
  - `telegram_messages`
  - `telegram_media`
  - `telegram_daily_summaries`
  - Related indexes were added in `batch/migrate_db.py`.
- Telegram batch:
  - Added `batch/telegram_sync.py`.
  - Modes:
    - `scheduled`
    - `dialogs`
    - `collect`
    - `summarize`
  - Scheduled mode exits without writing logs when `telegram_enabled=false`.
  - Collection stores messages by KST date/hour.
  - Images are stored as capped base64 text for display in the app.
  - AI summary uses OpenAI Responses API when `OPENAI_API_KEY` is configured.
  - Summary output stores positive, negative, and mentioned stocks after resolving them against `companies`.
- Telegram auth helper:
  - Added `batch/telegram_login.py` to create `TELEGRAM_SESSION_STRING`.
- GitHub Actions:
  - Added manual modes:
    - `telegram_dialogs`
    - `telegram_collect`
    - `telegram_summarize`
  - Scheduled workflow now also calls `telegram_sync.py --mode scheduled`.
  - Required secrets:
    - `TELEGRAM_API_ID`
    - `TELEGRAM_API_HASH`
    - `TELEGRAM_SESSION_STRING`
    - `OPENAI_API_KEY`
  - Optional variable:
    - `OPENAI_MODEL`
- Admin:
  - Added Telegram settings to `AdminDashboard`.
  - Added chat list refresh, manual collect, manual summarize buttons.
  - Added chat enable/disable selection UI.
  - Added APIs:
    - `/api/admin/telegram/chats`
    - `/api/admin/telegram/trigger`
- Discussion page:
  - Added `/discussions`.
  - Added `/api/discussions`.
  - Added `/api/discussions/trigger-metrics`.
  - Shows chat/date selectors, hourly messages, images, AI summaries, positive stocks, and negative stocks.
  - Admins can trigger financial batch collection for positive, negative, or all summary stocks.
- Navigation/protection:
  - Added `종목 토론` top menu link.
  - Protected `/discussions` through `proxy.ts`.

## Modified Files
- `.github/workflows/stock-batch.yml`
- `app/admin/AdminDashboard.tsx`
- `app/api/admin/telegram/chats/route.ts`
- `app/api/admin/telegram/trigger/route.ts`
- `app/api/discussions/route.ts`
- `app/api/discussions/trigger-metrics/route.ts`
- `app/discussions/page.tsx`
- `app/layout.tsx`
- `batch/migrate_db.py`
- `batch/telegram_login.py`
- `batch/telegram_sync.py`
- `batch/update_companies.py`
- `batch/update_metrics.py`
- `lib/batch-settings.ts`
- `lib/github-actions.ts`
- `proxy.ts`
- `requirements.txt`
- `project-logs/0017-us-common-stock-telegram-discussions.md`

## Verification
- `python -m compileall batch`
- `pip install -r requirements.txt`
- `python batch/migrate_db.py`
- `python batch/telegram_sync.py --mode scheduled`
  - Verified it exits safely when Telegram sync is disabled.
- `python batch/update_companies.py --market US --dry-run`
  - Result: US Common Stock universe is 4,155 rows in the current source snapshot.
- Verified `batch/update_metrics.py` US loader returns only names containing `Common Stock`.
- `npm run lint`
- `npm run build`
- Verified new Telegram tables and settings exist in Turso.

## Setup Notes
- Create Telegram API credentials from Telegram's developer site, then run:
  - `TELEGRAM_API_ID=... TELEGRAM_API_HASH=... python batch/telegram_login.py`
- Store the printed session string as GitHub secret `TELEGRAM_SESSION_STRING`.
- Add these GitHub secrets:
  - `TELEGRAM_API_ID`
  - `TELEGRAM_API_HASH`
  - `TELEGRAM_SESSION_STRING`
  - `OPENAI_API_KEY`
- Add optional GitHub Actions variable:
  - `OPENAI_MODEL`
- In the admin page:
  1. Save Telegram settings.
  2. Click `채팅방 목록 새로고침`.
  3. After GitHub Actions completes, click `목록 다시 읽기`.
  4. Enable the chat rooms to collect.
  5. Turn on `매시간 텔레그램 수집`.

## References
- Telegram user authorization requires an authorized user session: https://core.telegram.org/api/auth
- OpenAI recommends the Responses API for direct text-generation requests: https://platform.openai.com/docs/guides/text
