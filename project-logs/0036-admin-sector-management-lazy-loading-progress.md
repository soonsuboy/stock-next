# 0036 관리자 섹터 관리, 지연 로딩, 네비게이션 진행 표시

## 요청
- 섹터명, 설명, PER/PBR/ROE 가이드 같은 섹터 관련 데이터를 관리자가 수정하고 추가할 수 있게 만들기.
- 관리자 페이지에 `주식정보 관리` 탭을 추가하기.
- 관리자 페이지 첫 진입이 느리므로 모든 탭 데이터를 처음부터 가져오지 말고, 메인 탭만 먼저 보여주고 나머지는 탭을 누를 때 가져오게 개선하기.
- 상단 메인 메뉴 이동이 느리게 느껴지는 부분을 개선하거나, 이미 구조상 개선 여지가 제한적이면 로딩 프로그래스 바를 표시하기.

## 판단
- 기존 섹터 가이드는 `lib/gics-sector.ts` 하드코드 데이터를 직접 사용했다.
- 관리자 첫 진입은 `/api/admin/status`가 적재 현황과 최근 실행 내역까지 한 번에 조회해 무거운 집계 쿼리가 같이 실행되는 구조였다.
- 상단 메뉴 이동은 인증 상태와 보호 라우트 확인이 얽혀 있어 즉시 제거하기 어려운 대기 시간이 있으므로, 내부 링크 클릭 시 상단 프로그래스 바를 보여주는 방식으로 체감 대기 품질을 개선했다.

## 구현
- `stock_sector_guides` DB 테이블을 추가하고, 최초 접근 시 GICS 11대 섹터 기본 가이드를 `INSERT OR IGNORE`로 시드한다.
- 관리자 전용 `/api/admin/sectors` API를 추가했다.
  - `GET`: 전체 섹터 가이드 조회.
  - `POST`: 새 섹터 추가.
  - `PATCH`: 기존 섹터 수정 및 섹터명 변경 시 `companies.gics_sector`도 함께 갱신.
- 관리자 페이지에 `주식정보 관리` 탭과 `SectorManagementPanel`을 추가했다.
- 관심종목 API가 DB 섹터 목록을 같이 내려주고, 관심종목 화면의 섹터 선택/툴팁이 DB 데이터를 사용하게 바꿨다.
- `/api/admin/status`를 `summary`, `coverage`, `runs`, `all` 섹션 조회로 분리했다.
- 관리자 첫 진입은 `summary`만 가져오고, `배치적재현황`/`수동배치`는 `coverage`, `최근 배치 설정`은 `runs`를 탭 클릭 시 가져오게 했다.
- 내부 링크 클릭 후 지연이 120ms 이상이면 상단에 움직이는 프로그래스 바를 표시하는 `NavigationProgress`를 추가했다.

## 수정 파일
- `lib/sector-guides.ts`
- `app/api/admin/sectors/route.ts`
- `app/admin/SectorManagementPanel.tsx`
- `app/admin/AdminDashboard.tsx`
- `lib/admin-data.ts`
- `app/api/admin/status/route.ts`
- `app/api/watchlist/route.ts`
- `app/api/watchlist/[id]/route.ts`
- `app/watchlist/page.tsx`
- `app/NavigationProgress.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0036-admin-sector-management-lazy-loading-progress.md`

## 검증
- `npm run lint` 통과.
- `npm run build` 통과.

## 다음 에이전트 인수인계
- 섹터 가이드는 이제 DB의 `stock_sector_guides`가 우선이다.
- 기본 GICS 11대 섹터는 테이블이 비어 있거나 신규 환경에서 최초 접근 시 자동 시드된다.
- 관리자 섹터명 변경은 기존 회사의 `companies.gics_sector` 값도 새 이름으로 바꾼다.
- 관리자 페이지 첫 진입은 `summary`만 조회하므로 적재 현황/최근 실행 내역은 해당 탭을 눌렀을 때 처음 로딩된다.
- 상단 프로그래스 바는 실제 속도 개선이라기보다 사용자에게 이동 중임을 보여주는 체감 개선 장치다.

## 수행 시간
- 약 20분
