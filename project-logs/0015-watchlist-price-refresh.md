# 0015 Watchlist Price Refresh

## Request
- Store shares outstanding when collecting financial statements because market cap is shares outstanding multiplied by price.
- Refresh only prices for companies in users' watchlists once per day around the dawn batch window.
- Recalculate market cap from the refreshed price without re-fetching full financial statements.

## Plan
1. Extend `metrics_history` with `shares_outstanding`.
2. Make the existing KR/US metrics batch persist shares outstanding.
3. Add a lightweight watchlist-only price refresh batch.
4. Wire the new price refresh into the DB-backed scheduler and admin settings.
5. Keep the watchlist UI clear about price/market-cap refresh timing.

## Implementation
- Added `shares_outstanding REAL` to `metrics_history`.
  - Existing tables are migrated with `ALTER TABLE`.
  - Rebuilt legacy-compatible tables include the new column.
- Updated `batch/update_metrics.py`.
  - KR uses Daum `listedShareCount`.
  - US uses SEC/Yahoo share count logic that was already present, now persisted.
  - Snapshot dates now use KST, so dawn GitHub Actions runs write the Korean calendar date instead of the previous UTC date.
- Added `batch/update_watchlist_prices.py`.
  - Reads distinct companies from `user_watchlist`.
  - Joins the latest `metrics_history` row.
  - Fetches KR price/share data from Daum and US prices from Stooq.
  - Calculates market cap from refreshed price and stored/implied shares.
  - Recomputes PER/PBR from the new market cap and latest financial values.
  - Records `batch_runs` and `batch_run_items`.
- Updated scheduler behavior.
  - `batch/run_scheduled.py` runs watchlist price refresh daily when enabled.
  - Price refresh runs before heavier weekly company/financial batches so a later heavy-batch failure does not block daily price refresh.
- Updated GitHub Actions manual workflow.
  - Added `watchlist_prices` mode for manual testing.
  - `all` mode also runs watchlist price refresh.
- Updated admin settings.
  - Added `watchlist_price_enabled`, default `true`.
  - Admin page now exposes "관심종목 가격/시총 매일 갱신".
- Updated watchlist page text and added a recent price row.

## Modified Files
- `.github/workflows/stock-batch.yml`
- `app/admin/AdminDashboard.tsx`
- `app/watchlist/page.tsx`
- `batch/migrate_db.py`
- `batch/run_scheduled.py`
- `batch/update_metrics.py`
- `batch/update_watchlist_prices.py`
- `lib/batch-settings.ts`
- `project-logs/0015-watchlist-price-refresh.md`

## Verification
- `python -m compileall batch`
- `npm run lint`
- `npm run build`
- `python batch/migrate_db.py`
- Verified Turso `metrics_history` now has `shares_outstanding`.
- Dry-run:
  - `python batch/update_watchlist_prices.py --market ALL --limit 5 --dry-run`
  - Result: processed 5, succeeded 5, failed 0.
- Actual small write:
  - `python batch/update_watchlist_prices.py --market ALL --limit 5`
  - Result: processed 5, succeeded 5, failed 0.
  - Confirmed latest rows include KST snapshot date `2026-05-17`, close price, market cap, and shares outstanding.

## Handoff
- Daily scheduled GitHub Actions still wakes every 15 minutes; `batch/run_scheduled.py` decides whether the configured KST day has already run.
- The daily price refresh uses only watchlist companies, so its external requests scale with active watchlist size rather than all companies.
- US companies without stored shares and without an implied `market_cap / close_price` fallback will fail in the price-only batch until a full financial batch creates a metrics row.
- Admins can disable daily price refresh through `batch_settings.watchlist_price_enabled`.
