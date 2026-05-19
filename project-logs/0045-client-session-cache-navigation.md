# 0045 - Client Session Cache Navigation

## Request

- 상단 메인메뉴 이동과 관리자/관심종목/내부 탭 이동이 여전히 느리게 느껴진다.
- 관리자나 관심종목처럼 데이터 변화가 많지 않은 화면은 캐시를 활용해 빠르게 보여줄 수 있는지 확인하고 개선한다.
- 모바일에서도 캐시를 사용할 수 있는지 확인한다.

## Plan

1. Next.js 16 캐시 동작을 문서 기준으로 확인한다.
2. 서버 공용 캐시 대신 로그인 사용자 데이터가 섞이지 않는 브라우저 세션 캐시를 적용한다.
3. 관심종목, 분석, 관리자 탭, 종목검색 집계 그리드, 종목토론처럼 재방문이 잦은 화면은 캐시를 먼저 렌더링하고 백그라운드에서 최신 데이터를 갱신한다.
4. 관심종목 추가/삭제, 섹터 변경, 수동 배치 요청, 관리자 설정 저장처럼 데이터가 바뀌는 동작은 관련 캐시를 무효화하거나 최신 값으로 다시 저장한다.
5. 린트와 빌드로 검증한다.

## Implementation

- `sessionStorage` 기반 공통 캐시 유틸을 추가했다.
- 모바일 브라우저도 `sessionStorage`를 지원하므로 같은 방식으로 동작한다. 단, 브라우저가 저장소를 막거나 용량을 비우면 캐시 미스가 발생하고 기존 API 조회로 돌아간다.
- 서버 공용 캐시를 쓰지 않고 브라우저 탭 단위 캐시를 사용해 사용자별 데이터가 서버에서 섞이지 않게 했다.
- 사용자 ID가 바뀌면 앱 캐시를 모두 비우는 세션 캐시 경계 컴포넌트를 추가했다. 같은 탭에서 로그아웃 후 다른 계정으로 로그인해도 이전 사용자 데이터가 즉시 노출되지 않는다.
- 관심종목과 분석 화면은 5분 캐시를 먼저 보여주고 `/api/watchlist`, `/api/watchlist/analysis`를 백그라운드 갱신한다.
- 종목검색의 집계 기업 그리드는 필터/시장/페이지별로 5분 캐시한다.
- 관리자 상태, 적재 현황, 최근 실행 내역은 섹션별로 2분 캐시한다.
- 관리자 텔레그램 채팅방/요약 날짜/접근 코드/랭킹, 섹터 관리, 사용자 관리는 5분 캐시한다.
- 종목토론 텔레그램 조회는 채팅방/날짜별 2분 캐시하고, 스터디 AI 요약은 30분 캐시한다.
- 수동 새로고침 버튼은 캐시를 우회해 최신 데이터를 다시 요청하도록 유지했다.

## Modified Files

- `lib/client-cache.ts`
- `app/SessionCacheBoundary.tsx`
- `app/layout.tsx`
- `app/watchlist/page.tsx`
- `app/analysis/page.tsx`
- `app/search/page.tsx`
- `app/admin/AdminDashboard.tsx`
- `app/admin/SectorManagementPanel.tsx`
- `app/admin/UserManagementPanel.tsx`
- `app/discussions/DiscussionsClient.tsx`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 현재 캐시는 브라우저 탭의 `sessionStorage`에 저장된다. 새 탭, 브라우저 재시작, 저장소 차단 환경에서는 캐시 없이 기존 API 조회로 동작한다.
- 사용자별 화면에는 서버 공용 캐시를 적용하지 않았다. 로그인 사용자 데이터 혼선을 피하기 위한 의도적인 선택이다.
- 더 큰 성능 개선이 필요하면 다음 단계는 `latest_metrics` 전용 테이블이나 API 응답 크기 축소가 적합하다.
