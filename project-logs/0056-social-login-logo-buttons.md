# 0056 - Social Login Logo Buttons

## Request

- 로그인 기능은 원하는 수준으로 확인됐다.
- 로그인 버튼을 Google, Kakao, Naver 로고가 들어간 소셜 로그인 버튼 형태로 바꾸고 싶다.

## Implementation

- `app/login/page.tsx`를 정리했다.
  - Google, Kakao, Naver 버튼을 같은 반복 렌더링 구조로 구성했다.
  - 각 버튼에 provider 로고를 추가했다.
    - Google: 컬러 G SVG
    - Kakao: 노란 버튼 + K 로고
    - Naver: 초록 버튼 + N 로고
  - 기존 Google/Kakao 개별 서버 액션을 하나의 `signInWithProvider` 서버 액션으로 통합했다.
  - 환경변수가 없는 provider는 버튼이 보이되 비활성화된다.
- `auth.ts`에 Auth.js Naver provider를 optional로 추가했다.
  - Naver 키가 있으면 자동 등록된다.
  - 기존 사용자 ID 정책인 `provider:providerAccountId`를 그대로 유지한다.
  - Naver profile의 `response.name`, `response.nickname`, `response.email`, `response.profile_image`도 사용자 저장 fallback에 포함했다.
- `lib/oauth.ts`에 Naver OAuth 설정을 추가했다.
  - 기본 환경변수: `AUTH_NAVER_ID`, `AUTH_NAVER_SECRET`
  - alias: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
  - 콜백 URL: `/api/auth/callback/naver`

## Modified Files

- `app/login/page.tsx`
- `auth.ts`
- `lib/oauth.ts`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

## Handoff Notes

- Naver 로그인은 키가 없으면 비활성 상태로 표시된다.
- Naver Developers에 등록할 Redirect URI:
  - `http://localhost:3000/api/auth/callback/naver`
  - Vercel 배포 URL별 `https://.../api/auth/callback/naver`
- 네이버 키를 운영에 넣을 때는 Vercel Environment Variables에도 `AUTH_NAVER_ID`, `AUTH_NAVER_SECRET`을 추가하면 된다.
