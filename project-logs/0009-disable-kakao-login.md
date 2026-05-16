# 0009 - Disable Kakao Login

## Request

- Disable Kakao login because it is no longer needed.
- Hide the Kakao login button from the login page.

## Implementation

- Removed Kakao from the Auth.js provider registration path.
- Removed Kakao from the OAuth setup status list so missing Kakao env vars no longer appear on `/login`.
- Removed the Kakao server action and button from the login page.
- Kept Google login unchanged.

## Modified Files

- `auth.ts`
- `lib/oauth.ts`
- `app/login/page.tsx`
- `project-logs/0009-disable-kakao-login.md`

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Searched active app/auth files for Kakao references. Remaining matches are only in historical project logs and this handoff note.

## Notes For Next Agent

- The application now intentionally supports Google login only.
- `AUTH_KAKAO_ID` and `AUTH_KAKAO_SECRET` are no longer read by the app.
- If Kakao is needed again later, re-add it to `lib/oauth.ts`, import/register the provider in `auth.ts`, and restore a Kakao sign-in action/button in `app/login/page.tsx`.
