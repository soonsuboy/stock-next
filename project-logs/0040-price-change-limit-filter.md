# 0040 - 전일대비 등락률과 상한가/하한가 필터

## 요청
- 미국주식과 한국주식의 전일 종가와 당일 종가를 받아와 등락률을 직접 계산한다.
- 종목검색 메뉴의 집계 기업 목록에서 28% 이상 상승/하락 종목을 필터링해서 볼 수 있게 한다.
- 지표 카드의 가격 옆에 전일대비 등락률을 표시한다.

## 계획
1. 가격 수집 배치에서 전일 종가를 함께 받아 `change_rate = (당일 종가 - 전일 종가) / 전일 종가 * 100`으로 직접 계산한다.
2. `metrics_history`에 `previous_close`, `change_rate` 컬럼과 조회 인덱스를 추가한다.
3. 검색 API와 관심종목 API가 최신 지표의 전일 종가/등락률을 반환하도록 확장한다.
4. 종목검색 화면에 `전체`, `상한가 +28% 이상`, `하한가 -28% 이하` 필터를 추가하고 가격 옆에 등락률 배지를 표시한다.
5. 관심종목 카드의 최근 가격 옆에도 등락률과 전일 종가를 표시한다.

## 구현 내용
- Daum Finance 응답의 `tradePrice`, `changePrice`를 사용해 한국 주식 전일 종가와 등락률을 계산한다.
- Stooq quote CSV에 `Prev` 필드를 추가 요청해 미국 주식 전일 종가와 등락률을 계산한다.
- `metrics_history.previous_close`, `metrics_history.change_rate`를 배치 INSERT/UPSERT에 포함했다.
- 런타임 API에서 새 컬럼이 없는 기존 DB도 안전하게 조회되도록 `lib/metrics-price-schema.ts`를 추가했다.
- `/api/search/ranked`에 `filter=limit_up|limit_down`을 추가해 `change_rate >= 28`, `change_rate <= -28` 조건으로 필터링한다.
- 종목검색 집계 카드와 일반 검색 결과, 관심종목 카드에 등락률 배지를 표시한다.

## 수정 파일
- `batch/migrate_db.py`
- `batch/update_metrics.py`
- `batch/update_watchlist_prices.py`
- `lib/metrics-price-schema.ts`
- `app/api/search/route.ts`
- `app/api/search/ranked/route.ts`
- `app/api/watchlist/route.ts`
- `app/search/page.tsx`
- `app/watchlist/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0040-price-change-limit-filter.md`

## 검증
- `python -m py_compile batch/update_metrics.py batch/update_watchlist_prices.py batch/migrate_db.py`
- `npm run lint`
- `npm run build`

## 다음 에이전트 인수인계
- 기존 `metrics_history` 행은 배치가 다시 돌거나 관심종목 가격 배치가 실행되기 전까지 `previous_close`, `change_rate`가 비어 있을 수 있다.
- GitHub Actions의 `python batch/migrate_db.py` 실행 후 새 가격/재무 배치가 돌면 신규 컬럼이 채워진다.
- 종목검색의 상한가/하한가 필터 기준은 사용자 요청대로 절대값 28%이며, 한국/미국 시장을 동일 기준으로 처리한다.
