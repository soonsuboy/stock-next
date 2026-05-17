# 0027 - Navigation and DB read performance

## 요청
- 마이페이지에서 종목토론조회권한 조회가 30초 이상 걸리는 원인을 파악하고 개선한다.
- 상단 메뉴 이동, 관리자 페이지, 관심종목 등 전반적인 조회가 느린 문제를 개선한다.
- 모바일에서 더 느리게 느껴지는 부분도 고려한다.

## 원인
- `app/layout.tsx`가 모든 페이지 렌더링 때마다 `getDiscussionAccessStatus()`를 호출했다.
  - 이 함수는 Turso DB 조회와 권한 테이블 보장 로직을 포함한다.
  - 그래서 홈/종목검색/관심종목/관리자 등 메뉴 이동마다 상단 레이아웃이 DB 응답을 기다렸다.
- 마이페이지는 서버에서 사용자 확인 후, 클라이언트에서 다시 `/api/me/discussion-access`를 호출했다.
  - 모바일 네트워크에서는 이 추가 왕복이 크게 체감된다.
- 관심종목/분석/검색 API는 최신 지표를 가져올 때 `metrics_history` 전체를 `GROUP BY code, country`로 묶은 뒤 조인했다.
  - 지표 이력이 쌓일수록 매 조회마다 전체 이력 스캔 비용이 커진다.
- 관리자 페이지는 첫 진입 시 현재 탭과 무관한 텔레그램 채팅방/요약/토론코드 API를 동시에 호출했다.

## 구현
- `app/layout.tsx`
  - 레이아웃에서 종목토론 권한 DB 조회를 제거했다.
  - 로그인 사용자는 종목토론 메뉴를 볼 수 있고, 실제 접근 권한은 `/discussions` 페이지/API에서 계속 검사한다.
- `lib/discussion-access.ts`
  - 권한 테이블 보장 로직을 서버 프로세스 내 1회 promise로 캐시했다.
  - `getDiscussionAccessStatus()`에서 설정 여부와 사용자 권한 조회가 불필요하게 중복 보장 로직을 타지 않게 정리했다.
- `app/mypage/page.tsx`, `app/mypage/MyPageClient.tsx`
  - 종목토론 권한 상태를 서버에서 한 번 조회해 초기 props로 전달한다.
  - 첫 화면 표시 후 클라이언트가 다시 권한 API를 호출하던 경로를 제거했다.
- `app/api/watchlist/route.ts`, `app/api/watchlist/analysis/route.ts`
  - 관심종목 목록과 분석 데이터 조회를 전체 이력 `GROUP BY` 대신 관심종목별 최신 스냅샷 correlated lookup으로 변경했다.
- `app/api/search/route.ts`
  - 검색은 먼저 companies에서 최대 30개 후보를 고른 뒤, 그 후보에 대해서만 최신 metrics를 조회한다.
- `app/api/search/ranked/route.ts`
  - 최신 스냅샷 판별을 전체 `GROUP BY` CTE 대신 indexed correlated lookup으로 변경했다.
- `app/admin/page.tsx`, `app/admin/AdminDashboard.tsx`
  - 관리자 페이지에서 `auth()`를 중복 호출하던 경로를 제거했다.
  - 텔레그램 채팅방/요약/토론코드 조회는 텔레그램 탭을 열었을 때만 실행되도록 lazy load 처리했다.

## 검증
- Turso 샘플 쿼리 확인:
  - `watchlist_latest`: 8 rows, 약 496ms
  - `search_latest`: 1 row, 약 474ms
  - `ranked_latest_us`: 30 rows, 약 478ms
  - 수치는 로컬에서 Turso 원격 왕복까지 포함한 값이다.
- `npm run build`
- `npm run lint`

## 다음 에이전트 인수인계
- 종목토론 메뉴는 로그인 사용자에게 보이지만, 실제 페이지/API 접근은 기존 권한 체크로 막힌다.
- 더 큰 성능 개선이 필요하면 `latest_metrics` materialized table을 별도로 만들고 배치에서 함께 upsert하는 구조가 다음 단계다.
- 현재 변경은 스키마 추가 없이 읽기 쿼리와 불필요한 요청 제거만으로 배포 가능한 개선이다.
