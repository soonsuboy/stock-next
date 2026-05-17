# 0026 - Watchlist daily price refresh and shares display

## 요청
- 관심종목은 오늘 또는 가장 최근 주식 가격만 가져와 가격 데이터를 반영한다.
- 가격이 갱신되면 시가총액도 같이 반영한다.
- 가격 수집은 매일 아침 자동으로 돌게 한다.
- 관심종목 조회 화면에 최근 가격과 주식수도 같이 보여준다.
- 이미 반영된 기능은 중복 구현하지 않는다.

## 기존 상태
- `batch/update_watchlist_prices.py`가 이미 관심종목에 들어간 종목만 대상으로 최신 가격을 가져오고 있었다.
- 이 배치는 기존 재무제표 값은 유지하면서 `close_price`, `market_cap`, `shares_outstanding`, `PER`, `PBR` 등을 새 가격 기준으로 다시 계산한다.
- 다만 가격 배치 실행 시간이 전체 자동 배치 시간과 묶여 있었고, 관심종목 API/UI에는 `shares_outstanding`이 노출되지 않았다.

## 구현
- `batch/run_scheduled.py`
  - 관심종목 가격 갱신을 전체 재무/기업 배치와 분리했다.
  - 기본 가격 갱신 시간은 KST `06:30`이다.
  - GitHub Actions는 기존처럼 15분마다 깨어나고, `watchlist_price_time_kst` 이후 그날 처음 실행될 때 `batch/update_watchlist_prices.py --market ALL`을 실행한다.
  - 가격 배치 실행일/상태/체크 사유를 `batch_settings`에 기록한다.
- `lib/batch-settings.ts`, `batch/migrate_db.py`
  - `watchlist_price_time_kst`와 가격 배치 실행 메타 키를 추가했다.
  - 관리자 화면 저장/조회 타입에 새 설정을 포함했다.
- `app/admin/AdminDashboard.tsx`
  - 배치설정 탭에서 가격 갱신 시간(KST)을 볼 수 있고 수정할 수 있게 했다.
  - 마지막 가격 갱신 상태도 관리자 카드에 표시한다.
- `app/api/watchlist/route.ts`
  - 관심종목 API 응답에 `shares_outstanding`을 추가했다.
- `app/watchlist/page.tsx`
  - 관심종목 카드에 최근 가격, 주식수, 시가총액을 함께 표시한다.

## 실제 반영
- 로컬 환경변수로 Turso DB에 연결해 마이그레이션 실행.
- `python batch/update_watchlist_prices.py --market ALL` 실제 실행.
- 결과: 관심종목 8개 처리, 8개 성공, 0개 실패.
- 최신 행 예시:
  - KR:005930 삼성전자 close_price 270500, shares 5846278608, market_cap 1581418363464000
  - US:AAPL close_price 300.23, shares 14687356000, market_cap 4409584891880
  - US:TSLA close_price 422.24, shares 3752431984, market_cap 1584426880924.16

## 검증
- `python -m compileall batch\run_scheduled.py batch\migrate_db.py batch\update_watchlist_prices.py`
- `python batch\migrate_db.py`
- `python batch\update_watchlist_prices.py --market ALL`
- DB 최신 관심종목 가격/주식수/시가총액 샘플 조회
- `npm run lint`
- `npm run build`

## 다음 에이전트 인수인계
- 가격 갱신은 외부 실시간 조회를 앱 요청 시점에 하지 않고, GitHub Actions 배치에서 하루 한 번 DB에 저장하는 방식이다.
- 기본 시간은 KST 06:30이며 관리자 페이지에서 변경할 수 있다.
- 전체 재무 배치와 가격 전용 배치를 분리했기 때문에 사용량은 관심종목 수에 비례해 하루 한 번만 발생한다.
