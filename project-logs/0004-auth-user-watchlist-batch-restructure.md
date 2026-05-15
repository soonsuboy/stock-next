# 0004 - Auth, per-user watchlist, and DB batch restructure

## Request

- Add Google/Kakao login and logout with Auth.js.
- Require login before stock search, watchlist, and analysis.
- Separate watchlists by logged-in account.
- Disable real-time stock search and financial statement updates from Vercel functions.
- Move collection to an external batch process that writes most companies and metrics into Turso.
- Keep a detailed project log for future AI agents.

## Plan

1. Install `next-auth@beta` and add Auth.js route handlers.
2. Use provider account identity as the application user key:
   - `google:<providerAccountId>`
   - `kakao:<providerAccountId>`
3. Protect pages with Next.js 16 `proxy.ts` and protect API handlers again at data access time.
4. Replace global `watchlist` reads with `user_watchlist` reads.
5. Replace external live search with DB-only `companies` search.
6. Replace `/api/analyze` with a `410 Gone` response so Vercel does not collect financials.
7. Add `batch/` scripts and GitHub Actions for Turso migration, company master loading, and metrics loading.
8. Remove legacy root Python `api/` functions and `vercel.json` Python runtime config.

## Implementation

- Auth.js:
  - Added `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `proxy.ts`, `types/next-auth.d.ts`.
  - Added `/login` with Google and Kakao sign-in buttons.
  - Updated the root layout to show login/logout.
  - Session user ID is provider-scoped, so same email on Google/Kakao remains separate.
- API:
  - `/api/search` now requires auth and searches only Turso `companies`.
  - `/api/watchlist` now requires auth and uses `user_watchlist`.
  - `/api/watchlist/[id]` deletes only rows owned by the current user.
  - `/api/watchlist/analysis` joins the current user's watchlist with latest `metrics_history`.
  - `/api/analyze` returns `410` and performs no upstream calls.
- UI:
  - Watchlist page no longer has single/bulk financial update buttons.
  - Watchlist and analysis display latest DB batch metrics.
  - Search page copy now states it searches the DB-loaded company list.
  - Home/footer copy now references batch-collected DART/SEC data.
- Batch:
  - Added `batch/db.py` Turso HTTP pipeline helper.
  - Added `batch/migrate_db.py` for `app_users`, `companies`, `user_watchlist`, `metrics_history`, `batch_runs`, and `batch_run_items`.
  - Added `batch/update_companies.py` for DART corpCode, NASDAQ Trader, and SEC ticker-map-backed US company loading.
  - Added `batch/update_metrics.py` for KR DART/Daum and US SEC companyfacts/Stooq metrics.
  - Added `.github/workflows/stock-batch.yml`.
- Legacy cleanup:
  - Deleted tracked root `api/*.py` functions and `vercel.json` so Vercel does not deploy Python functions.

## Modified Files

- Added:
  - `.github/workflows/stock-batch.yml`
  - `auth.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `app/login/page.tsx`
  - `batch/db.py`
  - `batch/migrate_db.py`
  - `batch/update_companies.py`
  - `batch/update_metrics.py`
  - `lib/auth.ts`
  - `proxy.ts`
  - `types/next-auth.d.ts`
- Updated:
  - `app/api/analyze/route.ts`
  - `app/api/search/route.ts`
  - `app/api/watchlist/route.ts`
  - `app/api/watchlist/[id]/route.ts`
  - `app/api/watchlist/analysis/route.ts`
  - `app/layout.tsx`
  - `app/page.tsx`
  - `app/search/page.tsx`
  - `app/watchlist/page.tsx`
  - `app/analysis/page.tsx`
  - `package.json`
  - `package-lock.json`
- Deleted:
  - `api/`
  - `vercel.json`

## DB Work Performed

- Ran `python batch/migrate_db.py`.
- Ran `python batch/migrate_db.py --clear-legacy-watchlist`.
- Existing global `watchlist` and legacy `financials` rows were cleared.
- Loaded company masters into Turso:
  - KR companies: 3,965
  - US companies: 6,869
- Wrote a small KR metrics sample:
  - `metrics_history`: 3 rows
  - `batch_runs`: 1 row

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `python -m compileall batch` passed.
- `python batch/update_companies.py --dry-run` passed.
- `python batch/update_metrics.py --market KR --limit 3 --dry-run` passed.
- `python batch/update_metrics.py --market US --shard-index 0 --shard-count 7 --limit 5 --dry-run` exited successfully and recorded per-item failures because local SEC access returned no CIK data.
- Local HTTP checks:
  - `GET /api/search?q=AAPL` without login returns `401`.
  - `GET /search` without login redirects to `/login`.
  - `POST /api/analyze` returns `410`.

## Notes For Next Agent

- Required Vercel/Auth environment variables:
  - `AUTH_SECRET`
  - `AUTH_URL`
  - `AUTH_GOOGLE_ID`
  - `AUTH_GOOGLE_SECRET`
  - `AUTH_KAKAO_ID`
  - `AUTH_KAKAO_SECRET`
  - `AUTH_TRUST_HOST=true`
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
- Required GitHub Actions secrets:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
  - `DART_API_KEY`
  - `SEC_USER_AGENT`
- Google callback URL:
  - `/api/auth/callback/google`
- Kakao callback URL:
  - `/api/auth/callback/kakao`
- Local SEC requests returned `403`, so US company rows were loaded without CIK locally. The script preserves existing CIK values and will fill them when GitHub Actions can reach SEC ticker map successfully.
- The workflow runs daily at 18:00 UTC. In Korea time, Sunday runs company master + KR metrics + US shard 0; other days run one US shard.
- `companies` and `metrics_history` are now the app-facing source of truth. Legacy `watchlist` and `financials` should not be used by new app code.
