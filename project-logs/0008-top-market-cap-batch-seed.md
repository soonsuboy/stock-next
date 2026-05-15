# 0008 - Top Market Cap Batch Seed

## Request

- Explain when the new batch runs.
- Seed enough financial statement data to test the analysis dashboard now.
- Load the current top market-cap Korean and US-listed stocks, 10 each.

## Plan

1. Check the GitHub Actions schedule and the current Turso table counts.
2. Add a targeted batch option so specific stock codes can be refreshed without running thousands of companies.
3. Fix US batch collection issues found during dry-run:
   - US company CIK values were empty because the SEC ticker map can return 403.
   - SEC rejected the previous default User-Agent.
   - GOOGL/META did not expose SEC `EntityCommonStockSharesOutstanding`, so market cap needed a shares fallback.
   - TSM is an ADR, so shares needed ADS-aware handling.
4. Run dry-runs, then write KR/US top 10 metrics to Turso.
5. Verify row counts and build status.

## Implementation

- Added `--codes` to `batch/update_metrics.py`.
  - Example: `python batch/update_metrics.py --market US --codes NVDA,AAPL --dry-run`
  - When `--codes` is present, the shard filter is bypassed and only the requested companies are processed.
- Added known CIK fallback values for major US symbols so the batch can collect SEC `companyfacts` even if the SEC ticker map endpoint is unavailable.
- Changed the default SEC User-Agent to a simpler SEC-compatible contact format.
- Added IFRS/20-F support for foreign issuers such as TSM.
- Added Yahoo fundamentals-timeseries shares fallback for US market-cap calculation when SEC does not expose a usable shares outstanding fact.
- Normalized US class symbols in `batch/update_companies.py` by converting dots to dashes, so `BRK.B` becomes `BRK-B`.
- Added a manual GitHub Actions `codes` input for targeted metric refreshes.

## Seeded Data

Korean top 10 list used:

- `005930`, `000660`, `402340`, `005380`, `373220`, `009150`, `034020`, `329180`, `207940`, `000270`

US-listed top 10 list used:

- `NVDA`, `GOOGL`, `AAPL`, `MSFT`, `AMZN`, `AVGO`, `TSM`, `TSLA`, `META`, `WMT`

Both lists were successfully inserted into `metrics_history` for snapshot date `2026-05-16`.

## Verification

- `python -m compileall batch` passed.
- `python batch/update_metrics.py --market KR --codes ... --dry-run`:
  - processed 10, succeeded 10, failed 0.
- `python batch/update_metrics.py --market US --codes ... --dry-run`:
  - processed 10, succeeded 10, failed 0.
- Actual Turso writes:
  - KR: processed 10, succeeded 10, failed 0.
  - US: processed 10, succeeded 10, failed 0.
- DB verification:
  - KR 10 rows found, no missing `market_cap`.
  - US 10 rows found, no missing `market_cap`.
  - Latest `batch_runs` rows show `status='success'`.
- `npm run lint` passed.
- `npm run build` passed.

## Batch Schedule

- `.github/workflows/stock-batch.yml` has cron `0 18 * * *`.
- This is 03:00 KST daily.
- On Sunday KST, it refreshes:
  - company masters,
  - all KR metrics,
  - one US shard.
- Every day it refreshes one US shard, so US companies are spread across 7 shards and each stock is refreshed roughly once per week.
- The workflow must be pushed to GitHub and configured with repository secrets before the scheduled batch can run.

## Modified Files

- `.github/workflows/stock-batch.yml`
- `batch/update_companies.py`
- `batch/update_metrics.py`
- `project-logs/0008-top-market-cap-batch-seed.md`

## Notes For Next Agent

- The SEC ticker map endpoint may still return 403 depending on network/User-Agent. The metric batch is resilient for the seeded major symbols through `KNOWN_US_CIKS`.
- For a full production US run, set GitHub secret `SEC_USER_AGENT` to a real contact-style value, for example `soonsuboy-stock-next/1.0 your-email@example.com`.
- The DB currently has enough `metrics_history` data to test search, watchlist, and analysis triangle diagrams for the 20 seeded companies.
