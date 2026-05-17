# 0034. 관심종목별 수동수집 버튼

## 요청
- 관심종목에 있는 ASML처럼 자본총계, 당기순이익이 누락되어 PBR, PER, ROE가 나오지 않는 종목을 개별로 다시 수집할 수 있게 한다.
- 관심종목 화면에서 종목별 수동수집 버튼을 제공한다.
- 수동수집 시 재무제표뿐 아니라 최신 가격도 함께 가져와 오늘 기준 시가총액을 알 수 있게 한다.
- 앞으로 커밋/푸시는 자동으로 진행한다.

## 수행 시간
- 시작: 2026-05-18 08:10:23 KST
- 완료: 2026-05-18 08:12:50 KST
- 소요: 약 3분

## 구현 계획
1. 기존 관심종목 전체 재집계 API를 종목 1개 수동수집 요청도 받을 수 있게 확장한다.
2. 종목 1개 요청은 최근 집계 여부와 무관하게 GitHub Actions `update_metrics` 배치를 호출한다.
3. `update_metrics`는 기존 구조상 재무제표와 최신 quote를 함께 가져와 `close_price`, `market_cap`, `shares_outstanding`, PER/PBR/ROE를 저장한다.
4. 관심종목 카드에 `누락 수동수집`/`수동수집` 버튼과 요청 중 상태를 추가한다.
5. 검증, 발표 메모, 작업 로그를 남기고 자동 커밋/푸시한다.

## 반영 내용
- `/api/watchlist/reaggregate`가 JSON body의 `id` 또는 `code/country`를 받아 사용자의 해당 관심종목 1개만 조회하도록 확장했다.
- 단일 수동수집 요청은 24시간 이내 집계 스킵 로직을 적용하지 않고 강제로 `update_metrics` workflow를 dispatch한다.
- batch run 메시지에 `including latest quote`를 남겨 최신 가격 포함 수집임을 로그에서 확인할 수 있게 했다.
- 관심종목 카드마다 수동수집 버튼을 추가했다.
- 자본총계, 당기순이익, PER, PBR, ROE 중 하나라도 비어 있으면 버튼을 `누락 수동수집`으로 강조한다.
- 버튼 클릭 시 재무제표와 최신 가격/시가총액을 다시 수집한다는 확인창을 보여준다.

## 수정 파일
- `app/api/watchlist/reaggregate/route.ts`
- `app/watchlist/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0034-watchlist-single-manual-collect.md`

## 검증
- `npm run lint` 통과
- `npm run build` 통과
- 비로그인 상태에서 `/api/watchlist/reaggregate` 단일 종목 POST 요청이 401을 반환하는 것 확인

## 다음 에이전트 인수인계
- ASML 같은 외국 기업은 SEC companyfacts, Yahoo fallback, Stooq quote 흐름을 탄다.
- 단일 수동수집 버튼은 GitHub Actions 배치를 요청하는 방식이므로 값은 Actions 완료 후 새로고침해야 반영된다.
- 수동수집은 사용자가 직접 누른 액션이므로 24시간 스킵 조건을 무시한다.
