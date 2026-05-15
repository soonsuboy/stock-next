# 0006 - OAuth Vercel callback guidance

## Request

- Google OAuth setup needs localhost and deployed Vercel URLs.

## Implementation

- `lib/oauth.ts`
  - Added support for multiple OAuth base URLs.
  - Uses `AUTH_URL`, comma-separated `AUTH_ADDITIONAL_URLS`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL`.
  - Normalizes Vercel env values without protocol to `https://...`.
- `app/login/page.tsx`
  - Shows both JavaScript origins and redirect URIs.
  - Lists every configured local/deployed base URL.
- `.env.example`
  - Added `AUTH_ADDITIONAL_URLS`.
- Updated `project-logs/0005-oauth-login-local-test-setup.md` notes.

## Exact Google OAuth Values

For local development:

- JavaScript origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/auth/callback/google`

For Vercel, replace `<your-vercel-domain>` with the deployed domain being tested:

- JavaScript origin: `https://<your-vercel-domain>`
- Redirect URI: `https://<your-vercel-domain>/api/auth/callback/google`

For the deployment URL previously used in this project:

- JavaScript origin: `https://stock-next-7e0ze7owk-soonsuboys-projects.vercel.app`
- Redirect URI: `https://stock-next-7e0ze7owk-soonsuboys-projects.vercel.app/api/auth/callback/google`

## Notes For Next Agent

- Google OAuth redirect URIs must be exact; wildcards are not accepted.
- Vercel preview deployment URLs change. Prefer a stable production/custom domain for OAuth login testing.
- In Vercel project environment variables, set `AUTH_URL` to the stable deployed origin.
