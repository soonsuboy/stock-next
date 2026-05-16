# 0012 - Watchlist Reaggregate Skip Recent

## Request

- When multiple users have the same company in their watchlists, a company updated by one user should not need to be updated again by another user.
- During watchlist re-aggregation, skip companies whose latest metrics were collected within 24 hours.
- Show when each watchlist company's financial data was collected, including time.

## Plan

1. Read the latest `metrics_history.created_at` for each company in the current user's watchlist.
2. Treat `metrics_history` as global company data, not user-owned data.
3. Skip any watchlist company with latest `created_at` within 24 hours.
4. Dispatch GitHub Actions only for stale or never-collected watchlist companies.
5. Update the watchlist UI to show collection date and time.

## Implementation

- Updated `app/api/watchlist/reaggregate/route.ts`.
  - Joins current user's watchlist to latest `metrics_history`.
  - Classifies watchlist companies into:
    - `skippedRecent`: latest collected time is within 24 hours.
    - stale targets: missing metrics or collected more than 24 hours ago.
  - Sends GitHub Actions dispatch only for stale targets.
  - Returns a no-dispatch success response when all companies are fresh.
  - Applies `WATCHLIST_BATCH_MAX_CODES` to stale targets only.
- Updated `app/watchlist/page.tsx`.
  - Shows `집계: YYYY. MM. DD. HH:MM`.
  - Adds `(24시간 이내)` next to fresh collected data.
  - Shows how many fresh companies were skipped after a re-aggregation request.

## Behavior

- If user A updates `AAPL`, user B's watchlist re-aggregation skips `AAPL` for 24 hours because the global company metric is already fresh.
- If a company has no metrics or is older than 24 hours, it is included in the dispatch.
- If all watchlist companies are fresh, no GitHub Actions workflow is dispatched.

## Modified Files

- `app/api/watchlist/reaggregate/route.ts`
- `app/watchlist/page.tsx`
- `project-logs/0012-watchlist-reaggregate-skip-recent.md`

## Verification

- `npm run lint` passed.
- `npm run build` passed.

## Notes For Next Agent

- Freshness is based on latest `metrics_history.created_at`, not per-user watchlist state.
- `created_at` can be generated either by Python batch ISO timestamps or DB timestamps. The app normalizes both ISO `T` and space-separated timestamp strings.
