# 0021 Telegram Media Lazy Loading and Cache

## Request
- Telegram discussion images were not being shown.
- Before improving, identify where images are stored and whether displaying them can create Vercel Function usage problems.

## Findings
- Telegram image bytes are stored in Turso, not on the Vercel filesystem.
- Storage table: `telegram_media`.
- Image byte column: `telegram_media.data_base64`.
- The previous discussion API joined `telegram_media.data_base64` directly into `/api/discussions` and returned inline `data:` URLs in the JSON response.
- That structure made every discussion list request carry image bytes, increasing response size, function work, and Turso read payload.
- Vercel Function responses have a response body limit and Vercel's default function response cache behavior is not suitable for repeatedly returning large inline image JSON.
- Vercel's documented cache controls support `Vercel-CDN-Cache-Control` / `CDN-Cache-Control`, so immutable per-image responses are a better fit than inline base64.

## Implementation
- Added signed Telegram media URLs:
  - `/api/discussions` now returns image metadata and `mediaUrl`.
  - It no longer returns `data_base64` or inline `data:` URLs.
- Added `app/api/discussions/media/route.ts`:
  - Reads one media row from Turso.
  - Validates a short signed token derived from `AUTH_SECRET` or `TELEGRAM_MEDIA_TOKEN_SECRET`.
  - Returns the decoded image bytes with:
    - `Cache-Control: public, max-age=31536000, immutable`
    - `CDN-Cache-Control: public, max-age=31536000, immutable`
    - `Vercel-CDN-Cache-Control: public, max-age=31536000, immutable`
- Added `lib/telegram-media-token.ts` for signed URL creation and validation.
- Updated the discussions page to render `media.mediaUrl` instead of `media.dataUrl`.
- Added Telegram media backfill support:
  - `batch/telegram_sync.py --backfill` re-reads recent messages even when `last_message_id` already advanced.
  - Useful when text-only collection ran before media collection was enabled.
- Added admin UI button:
  - `이미지 백필 수집`
  - Dispatches `telegram_collect` with `telegram_backfill=true`.
- Added GitHub Actions workflow input:
  - `telegram_backfill`.

## Modified Files
- `.github/workflows/stock-batch.yml`
- `app/admin/AdminDashboard.tsx`
- `app/api/admin/telegram/trigger/route.ts`
- `app/api/discussions/route.ts`
- `app/api/discussions/media/route.ts`
- `app/discussions/page.tsx`
- `batch/telegram_sync.py`
- `lib/github-actions.ts`
- `lib/telegram-media-token.ts`
- `project-logs/0021-telegram-media-lazy-cache.md`

## Verification
- `python -m compileall batch/telegram_sync.py`
- `npm run lint`
- `npm run build`
- Ran local media backfill:
  - `python batch/telegram_sync.py --mode collect --hours-back 48 --limit 30 --media --backfill`
  - Result: processed 30 messages.
  - `telegram_media`: 13 stored image rows, about 2,005,244 base64 characters.
- Tested local image endpoint with a signed URL:
  - HTTP `200`
  - `content-type: image/jpeg`
  - `cache-control: public, max-age=31536000, immutable`
  - `vercel-cdn-cache-control: public, max-age=31536000, immutable`

## Operational Notes
- Current storage is acceptable for small image volumes but not ideal for large Telegram history.
- If image volume grows, move media bytes from Turso to object storage such as Vercel Blob, S3, or Cloudflare R2, and keep only media metadata / blob URL in Turso.
- Signed URLs reduce guessability, but anyone with a valid media URL can access that image while cached. Treat discussion media as app-internal but not strongly confidential until private object storage is introduced.

## Handoff
- To recover older images missed by earlier text-only collection, use Admin > 텔레그램 종목 토론 설정 > 이미지 백필 수집.
- Increase `최근 대화 조회 범위(시간)` before backfill if older messages need to be revisited.
- Keep `이미지 최대 크기(bytes)` conservative while Turso stores base64.
