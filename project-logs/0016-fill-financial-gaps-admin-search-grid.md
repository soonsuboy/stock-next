# 0016 Fill Financial Gaps, Admin Speed, Search Ranking Grid

## Request
- If collected companies still lack equity or net income, make them easy to re-aggregate.
- If the primary source does not provide those fields, try another source so dashboard data has fewer blanks.
- Improve the admin page because opening it can feel slow.
- Make recent batch execution history more complete; many May 17 afternoon runs looked like morning-only records.
- On the search page, show already collected companies split into Korean and US grids, filterable/sortable by market cap, ROE, PER, PBR, and price.

## Plan
1. Add an `incomplete` metrics selection for rows where the latest metrics have missing equity or net income.
2. Add secondary financial sources:
   - KR: FnGuide annual financial page, parsed in KRW from hundred-million-KRW units.
   - US: Yahoo fundamentals-timeseries annual values.
3. Store future batch timestamps with KST offsets so GitHub Actions UTC runs do not appear as Korean morning runs.
4. Pre-log user-dispatched GitHub workflow requests into `batch_runs`, then let the batch script update the same row using `request_id`.
5. Make admin status client-loaded and use lighter DB summary queries.
6. Add a ranked metrics API and search-page grids.

## Implementation
- `batch/update_metrics.py`
  - Expanded DART account matching by account id, statement type, and broader Korean account labels.
  - Added `fetch_fnguide_financials()` fallback for KR.
  - Added `fetch_yahoo_financials()` fallback for US.
  - Added `--selection incomplete`.
  - Added `--run-id` and `ON CONFLICT` upsert for `batch_runs`.
  - Changed batch timestamps to KST ISO strings with `+09:00`.
- `batch/update_companies.py`, `batch/run_scheduled.py`
  - Changed timestamps to KST ISO strings with `+09:00`.
- `batch/update_watchlist_prices.py`
  - Added `--run-id` and batch run upsert support.
- `.github/workflows/stock-batch.yml`
  - Added `incomplete` selection.
  - Added optional `request_id` input and forwards it to batch scripts.
- Admin
  - Added requested-run logging helper.
  - Manual admin dispatch now writes a `requested` row before GitHub Actions starts.
  - Watchlist reaggregation dispatch also pre-logs requested rows.
  - Watchlist reaggregation no longer skips a recently collected company if equity or net income is missing.
  - Admin page no longer blocks initial navigation on heavy status data; it renders a shell and loads status through `/api/admin/status`.
  - Admin status uses simpler parallel summary queries and shows the latest 100 runs.
  - Coverage cards now show incomplete financial rows.
  - Manual batch has a "재무 공백 재집계" button.
- Search
  - Added `/api/search/ranked`.
  - Rebuilt `/search` so collected KR and US companies are shown in separate grids.
  - Ranking options: market cap high, ROE high, PER low, PBR low, price high.

## Modified Files
- `.github/workflows/stock-batch.yml`
- `app/admin/AdminDashboard.tsx`
- `app/admin/page.tsx`
- `app/api/admin/trigger-batch/route.ts`
- `app/api/search/ranked/route.ts`
- `app/api/watchlist/reaggregate/route.ts`
- `app/search/page.tsx`
- `batch/migrate_db.py`
- `batch/run_scheduled.py`
- `batch/update_companies.py`
- `batch/update_metrics.py`
- `batch/update_watchlist_prices.py`
- `lib/admin-data.ts`
- `lib/batch-run-log.ts`
- `lib/github-actions.ts`
- `project-logs/0016-fill-financial-gaps-admin-search-grid.md`

## Verification
- `python -m compileall batch`
- `npm run lint`
- `npm run build`
- `python batch/migrate_db.py`
- `python batch/update_metrics.py --market KR --codes 005930 --dry-run`
- `python batch/update_metrics.py --market US --codes AAPL --dry-run`
- `python batch/update_metrics.py --market KR --selection incomplete --limit 3 --dry-run`
  - Result: 3 previously incomplete KR rows succeeded in dry-run.
- `python batch/update_metrics.py --market KR --selection incomplete --limit 3`
  - Result: 3 succeeded and wrote fallback-filled rows.
  - Confirmed latest `batch_runs.started_at` is stored as `2026-05-17T15:26:23+09:00`.
  - Confirmed sample KR rows (`000210`, `000400`, `000650`) now have both `equity` and `net_income` with `fnguide/annual` fallback recorded in `source`.
- Verified new indexes exist:
  - `idx_metrics_country_code_snapshot`
  - `idx_metrics_country_snapshot`
  - `idx_batch_runs_started`
  - `idx_batch_runs_completed`
- Timed the new admin summary subqueries against Turso; each returned in roughly half a second over the network and will now load client-side instead of blocking the page transition.

## Handoff
- The fallback sources reduce blanks, but some companies can still have no usable public financial values; those will remain visible as incomplete and can be retried through the admin "재무 공백 재집계" button.
- Existing old `batch_runs.started_at` rows are still UTC-like strings without timezone. New runs will use KST offsets, so future admin history should align with Korean afternoon/evening expectations.
- Manual dispatch rows can remain `requested` if GitHub Actions never starts or fails before invoking the Python script; this is intentional because it preserves the user's request in the DB log.
