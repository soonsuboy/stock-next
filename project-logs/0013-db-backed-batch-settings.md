# 0013 - DB Backed Batch Settings

## Request

- Improve the admin page so batch criteria can be viewed and changed through DB settings.
- Use DB setting changes instead of editing the GitHub Actions cron directly.

## Plan

1. Add a `batch_settings` table with default batch criteria.
2. Make the scheduled GitHub Actions workflow wake up frequently and let a Python scheduler decide whether to run based on DB settings.
3. Add admin APIs to read and save settings.
4. Add an automatic batch settings panel to `/admin`.
5. Reuse the watchlist freshness setting for account watchlist re-aggregation.

## Implementation

- Added `lib/batch-settings.ts`.
  - Ensures `batch_settings` exists.
  - Provides default values.
  - Normalizes and saves admin-edited settings.
- Updated `batch/migrate_db.py`.
  - Creates and seeds `batch_settings`.
- Added `batch/run_scheduled.py`.
  - Reads `batch_settings`.
  - Checks KST schedule time and execution window.
  - Prevents duplicate automatic execution per KST date.
  - Runs company master, KR metrics, and US shard work according to DB settings.
- Updated `.github/workflows/stock-batch.yml`.
  - Schedule now wakes every 15 minutes.
  - Scheduled run calls `python batch/run_scheduled.py`.
  - Manual `workflow_dispatch` behavior remains intact.
- Added `app/api/admin/settings/route.ts`.
  - `GET` returns settings.
  - `PATCH` saves settings.
- Updated `lib/admin-data.ts`.
  - Admin status now includes current settings.
- Updated `app/admin/AdminDashboard.tsx`.
  - Added automatic batch settings panel:
    - automatic schedule enabled/disabled,
    - KST execution time,
    - execution window,
    - company master day/enabled,
    - KR day/enabled/count,
    - US enabled/count/shard count,
    - scheduled target selection,
    - watchlist re-aggregation skip hours.
- Updated `app/api/watchlist/reaggregate/route.ts`.
  - Uses `batch_settings.watchlist_skip_recent_hours` instead of a hard-coded 24 hours.
- Updated `app/watchlist/page.tsx`.
  - Success messages now use the configured skip-hours value.

## Default Settings

- Automatic batch enabled: `true`
- KST execution time: `03:00`
- Execution window: `60` minutes
- Company master: enabled, Sunday
- KR metrics: enabled, Sunday, `0` means all companies
- US metrics: enabled, `1000` companies per scheduled run
- US shard count: `7`
- Scheduled selection: `all`
- Watchlist re-aggregation skip: `24` hours

## Verification

- `python -m compileall batch` passed.
- `python batch/migrate_db.py` passed and created/seeded `batch_settings`.
- `python batch/run_scheduled.py` passed outside the configured schedule window without launching collection.
- DB check confirmed `batch_settings` rows exist.
- `npm run lint` passed.
- `npm run build` passed.
- Build output includes `/api/admin/settings`.

## Notes For Next Agent

- GitHub Actions cron is intentionally frequent (`*/15 * * * *`) and no longer directly represents the desired batch time.
- The desired batch time lives in `batch_settings.schedule_time_kst`.
- `batch/run_scheduled.py` uses `last_scheduled_run_date_kst` to avoid duplicate automatic runs on the same KST date.
- Manual admin/user-triggered workflow dispatch remains separate from the automatic scheduler.
- Localhost manual dispatch still requires `GITHUB_ACTIONS_TOKEN` in `.env.local`; Vercel requires the same key in Vercel environment variables.
