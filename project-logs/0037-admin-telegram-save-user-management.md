# 0037 텔레그램 설정 저장과 사용자 관리

## 요청
- 관리자 페이지의 `텔레그램 종목 토론 설정` 탭에 설정 저장 버튼이 없어 보이므로 저장 버튼 추가.
- 관리자 페이지에 `사용자관리` 탭을 추가해 사용자를 조회하고 활성/비활성화할 수 있게 만들기.

## 판단
- 텔레그램 수집/이미지/AI 요약 설정은 기존 `settings` 상태에 포함되어 있었지만, 저장 버튼이 `배치설정` 탭에만 있어 텔레그램 탭에서 변경 후 저장하기 어려웠다.
- 사용자 계정은 `app_users` 테이블에 저장되고 있었지만 운영용 `active` 상태 컬럼이 없었다.
- 비활성화가 단순 표시로 끝나면 운영 기능으로 부족하므로, 인증 세션의 active 값을 확인해 보호 페이지/API 접근도 막히게 했다.

## 구현
- `텔레그램 종목 토론 설정` 탭에 `텔레그램 설정 저장` 버튼을 추가했다.
- `app_users`에 운영 컬럼을 보강했다.
  - `active INTEGER NOT NULL DEFAULT 1`
  - `disabled_at TEXT`
  - `last_login_at TEXT`
- 로그인 시 `last_login_at`을 갱신하고, 기존 비활성 상태는 덮어쓰지 않게 했다.
- Auth.js JWT/session에 `userActive`/`active` 값을 실어 보호 라우트와 `getCurrentUser()`에서 비활성 사용자를 차단하게 했다.
- 관리자 전용 `/api/admin/users` API를 추가했다.
  - `GET`: 사용자 목록 조회.
  - `PATCH`: 사용자 활성/비활성 상태 변경.
  - 현재 로그인한 관리자 본인은 비활성화할 수 없도록 보호했다.
- 관리자 페이지에 `사용자관리` 탭과 `UserManagementPanel`을 추가했다.
- 마이그레이션 스크립트에도 사용자 운영 컬럼 추가를 반영했다.

## 수정 파일
- `app/admin/AdminDashboard.tsx`
- `app/admin/UserManagementPanel.tsx`
- `app/api/admin/users/route.ts`
- `auth.ts`
- `lib/auth.ts`
- `lib/app-users.ts`
- `types/next-auth.d.ts`
- `app/login/page.tsx`
- `batch/migrate_db.py`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0037-admin-telegram-save-user-management.md`

## 검증
- `npm run lint` 통과.
- `npm run build` 통과.

## 다음 에이전트 인수인계
- 사용자 비활성화는 `app_users.active = 0`으로 처리한다.
- 비활성 사용자는 Auth.js 세션에 `active = false`로 반영되고 보호 페이지/API에서 막힌다.
- 현재 로그인한 관리자 계정의 자기 비활성화는 API에서 차단한다.
- 텔레그램 탭의 저장 버튼은 기존 `/api/admin/settings`를 재사용한다.

## 수행 시간
- 약 5분
