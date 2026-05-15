# 0005 - OAuth login local test setup

## Request

- Google/Kakao login should be testable locally.
- Visiting `/api/auth/signin/kakao` was showing the Auth.js server configuration error page.

## Root Cause

- Local `.env.local` only had Turso and DART settings.
- Auth.js providers were always registered, but `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET`, and `AUTH_SECRET` were missing.
- With missing provider credentials, Auth.js returned a server configuration error.

## Implementation

- Added `lib/oauth.ts`:
  - centralizes Google/Kakao OAuth environment variable checks
  - exposes JavaScript origins and callback URLs for setup display
  - supports `AUTH_ADDITIONAL_URLS` plus Vercel-provided deployment URL envs
- Updated `auth.ts`:
  - registers Google only when Google OAuth env values exist
  - registers Kakao only when Kakao OAuth env values exist
  - adds a local-development fallback secret so missing `AUTH_SECRET` does not break local checks
  - routes Auth.js configuration errors back to `/login`
- Updated `/login`:
  - disables provider buttons when credentials are missing
  - shows missing env keys, JavaScript origins, and exact callback URLs
  - shows an actionable setup message when OAuth redirects back with an error
- Added `.env.example` with all required OAuth variables.
- Updated local ignored `.env.local` with:
  - `AUTH_SECRET`
  - `AUTH_URL=http://localhost:3000`
  - `AUTH_TRUST_HOST=true`
  - blank Google/Kakao OAuth placeholders

## Modified Files

- `auth.ts`
- `app/login/page.tsx`
- `lib/oauth.ts`
- `.env.example`
- `.env.local` (ignored local file)
- `project-logs/0005-oauth-login-local-test-setup.md`

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `GET /login` returns `200` and shows setup guidance instead of crashing.
- `GET /api/auth/signin/kakao` redirects back to `/login?error=Configuration` when Kakao credentials are still empty.

## Notes For Next Agent

- Real Google/Kakao OAuth cannot complete until the user fills actual client IDs and secrets.
- Local callback URLs to register:
  - JavaScript origin: `http://localhost:3000`
  - Google: `http://localhost:3000/api/auth/callback/google`
  - Kakao: `http://localhost:3000/api/auth/callback/kakao`
- For deployed Vercel login, also register:
  - JavaScript origin: `https://<your-vercel-domain>`
  - Google: `https://<your-vercel-domain>/api/auth/callback/google`
  - Kakao: `https://<your-vercel-domain>/api/auth/callback/kakao`
- Optional local display helper:
  - `AUTH_ADDITIONAL_URLS=https://<your-vercel-domain>`
- After editing `.env.local`, restart `npm run dev`; Next.js does not reliably reload new env values into an already-running dev process.
