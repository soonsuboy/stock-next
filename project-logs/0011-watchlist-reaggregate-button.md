# 0011 - Watchlist Reaggregate Button

## Request

- Add a button that re-aggregates financial statements for the companies in the current account's watchlist.
- Use the admin page implementation as a reference.
- Continue keeping implementation logs.

## Plan

1. Reuse the GitHub Actions workflow dispatch pattern from the admin page.
2. Move workflow dispatch into a shared helper.
3. Add a user-authenticated watchlist endpoint that reads only the current user's `user_watchlist`.
4. Dispatch one batch per market using the exact watchlist codes.
5. Add a button on `/watchlist`.

## Implementation

- Added `lib/github-actions.ts`.
  - Centralizes GitHub Actions workflow configuration and dispatch.
  - Reads `GITHUB_ACTIONS_TOKEN`, repository, workflow id, and ref from environment variables.
- Updated `app/api/admin/trigger-batch/route.ts` to use the shared dispatch helper.
- Updated `lib/admin-data.ts` to read workflow config from the shared helper.
- Added `app/api/watchlist/reaggregate/route.ts`.
  - Requires login.
  - Queries only the current user's watchlist.
  - Groups codes by `KR` and `US`.
  - Dispatches GitHub Actions with `codes=<current user's watchlist codes>` and `selection=all`.
  - Does not collect financial data inside Vercel.
- Updated `app/watchlist/page.tsx`.
  - Added `재무제표 재집계` button.
  - Shows success/error messages after dispatch request.

## Runtime Configuration

- Required for the button to work in Vercel:
  - `GITHUB_ACTIONS_TOKEN`
- Optional:
  - `WATCHLIST_BATCH_MAX_CODES`, default `100`, capped at `500`

## Behavior

- If a user has both Korean and US stocks in their watchlist, the endpoint dispatches separate KR and US workflow runs.
- The button only requests a batch. Updated financial values appear after GitHub Actions finishes and the user refreshes/reloads the watchlist.
- If `GITHUB_ACTIONS_TOKEN` is missing, the API returns a clear 503 error.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Build output includes `/api/watchlist/reaggregate`.

## Notes For Next Agent

- The API intentionally does not require admin access. It is scoped by the authenticated user's watchlist.
- The workflow already supports `--codes`, so this feature avoids broad market scans.
- If users may keep more than 100 watchlist items, either raise `WATCHLIST_BATCH_MAX_CODES` or add chunked workflow dispatching.
