# 0024 Admin Tabs and Multi Discussion Codes

## Request
- Admin page shows too many functions at once.
- Split admin page into tabs:
  - 배치설정
  - 배치적재현황
  - 텔레그램종목 토론설정
  - 수동배치
  - 최근 배치 설정
- Discussion access codes should support periods and multiple codes:
  - Example: one user gets a 1-month code, another gets a 1-year code.

## Implementation
- Added tab state to `AdminDashboard`.
- Moved existing admin sections into the requested tabs.
- Kept `종목토론 접근 설정` inside `텔레그램종목 토론설정`.
- Added multi-code discussion access model:
  - New table: `discussion_access_codes`.
  - Fields include `label`, `code_hash`, `duration_days`, `active`, timestamps.
  - Codes are stored hashed only.
- Extended user access:
  - `user_discussion_access` now stores `code_id`, `code_hash`, `granted_at`, `expires_at`.
  - Entering a valid code grants access until `now + duration_days`.
  - Deactivating a code blocks future and current access tied to that code.
- Updated APIs:
  - `GET /api/admin/discussion-code` returns code list.
  - `POST /api/admin/discussion-code` creates a new code with duration.
  - `PATCH /api/admin/discussion-code` activates/deactivates a code.
  - `POST /api/me/discussion-access` grants access using the matched code duration.
- Updated My Page to show discussion access expiry time.
- Added migration support:
  - Creates `discussion_access_codes`.
  - Adds `code_id` and `expires_at` to `user_discussion_access`.
  - Migrates the legacy single `discussion_access_code_hash` into a `기존 코드` with 365 days when present.

## Modified Files
- `app/admin/AdminDashboard.tsx`
- `app/api/admin/discussion-code/route.ts`
- `app/api/me/discussion-access/route.ts`
- `app/mypage/MyPageClient.tsx`
- `batch/migrate_db.py`
- `lib/discussion-access.ts`
- `project-logs/0024-admin-tabs-multi-discussion-codes.md`

## Verification
- `npm run lint`
- `npm run build`
- `python -m compileall batch/migrate_db.py`
- Ran DB migration with `.env.local` loaded.
- Confirmed:
  - `discussion_access_codes` table exists.
  - `user_discussion_access` has `code_id` and `expires_at`.

## Handoff
- Admin can create multiple codes in Admin > 텔레그램종목 토론설정 > 종목토론 접근 설정.
- Use duration days:
  - 30 for roughly 1 month.
  - 365 for 1 year.
- Users enter the code in My Page.
- If a code is deactivated, access granted through that code stops working.
