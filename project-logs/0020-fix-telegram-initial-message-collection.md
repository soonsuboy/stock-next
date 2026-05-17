# 0020 Fix Telegram Initial Message Collection

## Request
- Telegram chat rooms were loaded, but messages inside the selected room were not collected.

## Diagnosis
- DB had 7 Telegram chats and 1 enabled chat.
- `telegram_messages` had 0 rows.
- The enabled chat was accessible through Telegram API and latest messages existed.
- Latest message was around KST `2026-05-17 12:21`, while `telegram_collect_hours_back` was `2`.
- Initial collection only imports messages within the configured recent-hours window when `last_message_id=0`.
- Manual `telegram_collect` workflow mode also used script defaults instead of DB admin settings.

## Implementation
- Updated `batch/telegram_sync.py`.
  - Manual `--mode collect` now reads DB settings when CLI args are omitted.
  - Scheduled mode default fallback changed from 2 hours to 24 hours.
  - CLI options `--hours-back`, `--limit`, `--media`, and `--media-max-bytes` are now optional overrides rather than always forcing defaults.
- Updated default Telegram collection setting to 24 hours:
  - `batch/migrate_db.py`
  - `lib/batch-settings.ts`
- Updated admin helper copy to recommend 24+ hours for first collection.
- Updated the current DB setting:
  - `telegram_collect_hours_back=24`

## Modified Files
- `batch/telegram_sync.py`
- `batch/migrate_db.py`
- `lib/batch-settings.ts`
- `app/admin/AdminDashboard.tsx`
- `project-logs/0020-fix-telegram-initial-message-collection.md`

## Verification
- Confirmed the enabled chat is accessible through Telegram API.
- Ran:
  - `python batch/telegram_sync.py --mode collect --limit 20 --no-media`
- Result:
  - `processed=20`
  - `telegram_messages` total: 20
  - latest stored message: `2026-05-17T12:21:27+09:00`
  - dates stored:
    - `2026-05-17`: 8 messages
    - `2026-05-16`: 12 messages
- `/discussions` returned HTTP 200 locally.

## Handoff
- The first collection needs a backfill window large enough to include existing messages.
- After the first successful import, `last_message_id` lets later hourly runs collect only newer messages.
- If old history is needed, temporarily set `telegram_collect_hours_back` higher in admin settings and reset the chat's `last_message_id` if necessary.
