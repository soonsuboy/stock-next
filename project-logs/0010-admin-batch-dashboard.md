# 0010 - Admin Batch Dashboard

## Request

- Add a separate admin page.
- Show when batches ran and how many companies are stored in the DB.
- Add manual batch buttons.
- Manual batch should accept a company count and fetch only that many companies.
- New manual batch should skip companies already having metrics in DB.
- Existing companies should have a separate re-aggregation/update button.
- Continue keeping implementation logs for future agents.

## Plan

1. Extend the Python metric batch with a selection mode:
   - `all`
   - `missing`: companies without any `metrics_history`
   - `existing`: companies already having `metrics_history`
2. Extend GitHub Actions `workflow_dispatch` inputs so the web app can request targeted runs.
3. Add admin-only APIs:
   - status query for DB coverage and recent `batch_runs`
   - manual trigger endpoint that dispatches GitHub Actions instead of collecting data inside Vercel
4. Add `/admin` dashboard UI.
5. Protect `/admin` with login and `ADMIN_EMAILS`.
6. Validate with lint/build and batch dry-run commands.

## Implementation

- Added `--selection all|missing|existing` to `batch/update_metrics.py`.
- Added `selection` input to `.github/workflows/stock-batch.yml`.
- Added admin helpers:
  - `lib/admin.ts`
  - `lib/admin-data.ts`
- Added admin API routes:
  - `app/api/admin/status/route.ts`
  - `app/api/admin/trigger-batch/route.ts`
- Added admin UI:
  - `app/admin/page.tsx`
  - `app/admin/AdminDashboard.tsx`
- Added `/admin` to protected Auth.js paths and proxy matcher.
- Added an admin nav link when the current user email is allowed.

## Runtime Configuration

Vercel needs these additional environment variables for the admin feature:

- `ADMIN_EMAILS`
  - Comma-separated Google account emails allowed to open `/admin`.
- `GITHUB_ACTIONS_TOKEN`
  - GitHub token that can dispatch workflows for `soonsuboy/stock-next`.
- Optional:
  - `GITHUB_ACTIONS_REPOSITORY`, defaults to `soonsuboy/stock-next`
  - `GITHUB_ACTIONS_WORKFLOW`, defaults to `stock-batch.yml`
  - `GITHUB_ACTIONS_REF`, defaults to `main`
  - `ADMIN_BATCH_MAX_LIMIT`, defaults to `500`, capped at `1000`

## Behavior

- `/admin` shows:
  - company master count by market,
  - companies with metrics,
  - companies still missing metrics,
  - metrics row count,
  - latest snapshot date,
  - recent `batch_runs`.
- Manual `미적재 기업 수집` dispatches:
  - `mode=kr|us`
  - `selection=missing`
  - `limit=<input count>`
- Manual `기존 기업 재집계` dispatches:
  - `mode=kr|us`
  - `selection=existing`
  - `limit=<input count>`
- Collection still runs in GitHub Actions, not inside Vercel serverless functions.

## Verification

- `python -m compileall batch` passed.
- `python batch/update_metrics.py --market KR --selection missing --limit 1 --dry-run` passed.
- `python batch/update_metrics.py --market KR --selection existing --limit 1 --dry-run` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Build output includes:
  - `/admin`
  - `/api/admin/status`
  - `/api/admin/trigger-batch`

## Notes For Next Agent

- If the admin page says manual dispatch is not configured, set `GITHUB_ACTIONS_TOKEN` in Vercel and redeploy.
- If the admin page denies access in production, set `ADMIN_EMAILS` in Vercel and redeploy.
- The GitHub token should be stored in Vercel, not in GitHub Actions secrets, because the Vercel app is the caller that dispatches the workflow.
