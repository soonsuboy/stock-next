# 0023 Discussion Access Code and My Page

## Request
- Hide stock discussions unless the user is logged in and has entered an admin-configured access code.
- Add a My Page where logged-in users can enter the discussion access code.
- Add an admin setting where the discussion access code can be configured.

## Implementation
- Added per-user discussion access:
  - `user_discussion_access`
  - Stores `user_id`, `code_hash`, and `granted_at`.
  - Access is valid only while the stored user `code_hash` matches the current admin code hash.
  - If the admin changes the code, users must enter the new code again.
- Added secure access code helpers:
  - `lib/discussion-access.ts`
  - Admin code is stored as a SHA-256 hash in `batch_settings.discussion_access_code_hash`.
  - Plaintext code is never returned to the client.
- Added My Page:
  - `/mypage`
  - Shows account information.
  - Lets logged-in users enter the `종목토론조회 코드`.
  - Shows a link to `/discussions` after access is granted.
- Added admin access code API:
  - `GET/PATCH /api/admin/discussion-code`
  - Empty code disables discussion access for everyone.
- Added user access API:
  - `GET/POST /api/me/discussion-access`
- Locked discussion surfaces:
  - `/discussions` redirects unauthenticated users to login.
  - `/discussions` redirects users without a valid code grant to `/mypage?discussion=locked`.
  - `/api/discussions` now requires login plus discussion access.
  - `/api/discussions/media` now requires login plus discussion access.
- Updated navigation:
  - `마이페이지` appears for logged-in users.
  - `종목 토론` appears only for logged-in users with valid discussion access.
- Adjusted media caching:
  - Telegram images now use private browser cache.
  - Vercel CDN public cache is disabled for discussion media because access is now user-gated.
- Updated login:
  - Preserves safe internal `callbackUrl` after Google login.

## Modified Files
- `app/admin/AdminDashboard.tsx`
- `app/api/admin/discussion-code/route.ts`
- `app/api/discussions/media/route.ts`
- `app/api/discussions/route.ts`
- `app/api/me/discussion-access/route.ts`
- `app/discussions/DiscussionsClient.tsx`
- `app/discussions/page.tsx`
- `app/layout.tsx`
- `app/login/page.tsx`
- `app/mypage/MyPageClient.tsx`
- `app/mypage/page.tsx`
- `auth.ts`
- `batch/migrate_db.py`
- `lib/admin-data.ts`
- `lib/batch-settings.ts`
- `lib/discussion-access.ts`
- `proxy.ts`
- `project-logs/0023-discussion-access-code-mypage.md`

## Verification
- Ran DB migration with local environment loaded.
- Confirmed `batch_settings.discussion_access_code_hash` exists.
- Confirmed `user_discussion_access` includes `code_hash`.
- `npm run lint`
- `npm run build`
- `python -m compileall batch/migrate_db.py`
- Anonymous checks:
  - `/api/discussions` returns `401`.
  - `/mypage` redirects to login.
  - `/discussions` redirects to login.

## Handoff
- Admin must set the discussion code in Admin > `종목토론 접근 설정`.
- User must log in, open `마이페이지`, and enter the code.
- Only after that will `종목 토론` appear in the top menu and `/discussions` open.
- If the admin changes the code, already granted users must enter the new code again.
