# 0050 - Watchlist Grid Sort

## Request

- 관심종목이 많아졌을 때 카드형 UI가 불편하므로 엑셀처럼 그리드 형태로 조회되게 바꾼다.
- 관심종목에서 ROE, PBR, PER, 주식가격, 시가총액 기준으로 정렬할 수 있는 버튼을 추가한다.

## Implementation

- `app/watchlist/page.tsx`의 관심종목 목록을 카드 레이아웃에서 가로 스크롤 가능한 테이블 그리드로 변경했다.
- 그리드 컬럼에 기업명, 섹터, ROE, PBR, PER, 가격, 전일가격, 등락률, 시가총액, 주식수, 자본총계, 당기순이익, 집계시각, 관리 버튼을 배치했다.
- 정렬 상태(`sortKey`, `sortDirection`)와 `useMemo` 기반 정렬 목록을 추가했다.
- 정렬 버튼은 다음 기준을 지원한다.
  - ROE: 기본 내림차순
  - PBR: 기본 오름차순
  - PER: 기본 오름차순
  - 주식가격: 기본 내림차순
  - 시가총액: 기본 내림차순
- 같은 정렬 버튼을 다시 누르면 오름차순/내림차순이 토글되게 했다.
- 기존 기능인 섹터 수동 변경, 섹터 툴팁, 분석 이동, 수동수집, 삭제 기능은 테이블 행 안에서 계속 사용할 수 있게 유지했다.

## Modified Files

- `app/watchlist/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 현재 관심종목 그리드는 전체 관심종목을 한 번에 렌더링한다.
- 사용자별 관심종목 수가 수백 개 이상으로 커지면 페이지네이션 또는 가상 스크롤을 추가하는 것이 좋다.
- 정렬 기준에 결측값이 있는 종목은 아래로 내려가며, 동률일 때는 최근 추가순으로 보조 정렬한다.
