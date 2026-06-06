# 0055 - Kakao OAuth Login

## Request

- 카카오 OAuth 키 설정을 완료했으니 Google 로그인처럼 카카오 로그인도 동일하게 추가한다.

## Implementation

- `auth.ts`에 Auth.js Kakao provider를 다시 등록했다.
  - Google과 동일하게 provider 계정 기준 사용자 ID를 생성한다.
  - 사용자 ID 형식은 기존 정책대로 `provider:providerAccountId`다.
  - 따라서 같은 이메일이어도 Google 계정과 Kakao 계정은 별도 사용자로 유지된다.
- `lib/oauth.ts`에 Kakao OAuth provider 설정을 추가했다.
  - 기본 환경변수: `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET`
  - 보조 환경변수 alias: `KAKAO_CLIENT_ID`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
  - setup 안내에 `/api/auth/callback/kakao` 콜백 URL이 표시된다.
- `app/login/page.tsx`에 `카카오로 계속하기` 버튼과 서버 액션을 추가했다.
  - 기존 Google 로그인과 같은 callbackUrl 보존 로직을 사용한다.
  - Kakao 환경변수가 없으면 버튼이 비활성화된다.
- `app/admin/page.tsx`의 관리자 권한 안내 문구를 Google 전용 표현에서 일반 이메일 표현으로 수정했다.

## Environment Notes

- Kakao Developers redirect URI에 아래 주소를 등록해야 한다.
  - `http://localhost:3000/api/auth/callback/kakao`
  - Vercel 배포 URL별 `https://.../api/auth/callback/kakao`
- Vercel Environment Variables에도 `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET`을 추가해야 배포 사이트에서 버튼이 활성화된다.
- 현재 작업 중 읽은 로컬 `.env.local`에서는 `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET` 값이 비어 있는 것으로 감지됐다. 값을 저장하고 개발 서버를 재시작해야 로컬 버튼이 활성화된다.

## Modified Files

- `auth.ts`
- `lib/oauth.ts`
- `app/login/page.tsx`
- `app/admin/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

## Handoff Notes

- 실제 카카오 OAuth 왕복 로그인은 로컬 `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET` 값이 채워진 뒤 테스트해야 한다.
- Kakao Developers 콘솔에서 카카오 로그인 활성화, Web 플랫폼 도메인, Redirect URI, 동의항목 이메일 설정을 확인해야 한다.
