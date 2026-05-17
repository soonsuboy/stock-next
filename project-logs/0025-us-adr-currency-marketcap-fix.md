# 0025 - US ADR currency and market cap fix

## 요청
- 미국주식 집계에서 Banco Santander - Chile ADS(BSAC)의 시가총액이 US$5.69조로 과대 계산되는 문제를 확인하고 수정한다.
- 원인 후보는 CLP/USD 통화 착각 또는 ADS/ADR 비율 누락이다.
- 정확한 값으로 다시 집계할 수 있게 하고, 필요하면 특정 종목만 재집계할 수 있게 한다.

## 원인
- BSAC의 SEC companyfacts 주식 수는 원주 기준 약 188,446,126,794주인데, Stooq 가격은 NYSE ADS 기준 약 US$30대이다.
- 기존 코드는 원주 수에 ADS 가격을 곱해 시가총액을 계산해서 약 400배 과대 계산했다.
- BSAC의 재무제표 XBRL 값은 CLP 단위인데, 기존 SEC 파서가 USD 단위만 찾거나 단위 정보를 잃어 재무 지표 정확도가 떨어졌다.
- `latest_fact`에서 후보 행을 추가하는 코드가 `continue` 아래에 들어가 SEC 재무값을 실제로 수집하지 못하는 버그도 있었다.

## 구현
- `batch/update_metrics.py`
  - BSAC ADS ratio를 400으로 추가했다.
  - SEC companyfacts에서 USD 외 CLP/EUR/GBP/CAD 등 주요 통화 단위를 읽도록 확장했다.
  - XBRL row의 `_unit`을 보존하고, 비 USD 재무값은 Stooq FX로 USD 환산 후 PER/PBR/ROE를 계산한다.
  - BSAC는 재무 통화 override를 CLP로 명시했다.
  - ADS ratio가 있는 종목은 SEC 원주 수를 ADS 환산 주식 수로 나눈 뒤 시총을 계산한다.
  - 특정 코드 재집계(`--codes`)는 US Common Stock 필터를 우회해 ADS 종목도 직접 재집계할 수 있게 했다.
- `batch/update_watchlist_prices.py`
  - 관심종목 가격만 갱신하는 배치에서도 ADS ratio가 있는 종목의 저장 주식 수가 원주 수로 남아 있으면 나눠서 시총을 계산하게 했다.
- `app/api/admin/trigger-batch/route.ts`
  - 관리자 수동 배치 API가 `codes` 입력을 받아 특정 종목만 GitHub Actions로 dispatch할 수 있게 했다.
- `app/admin/AdminDashboard.tsx`
  - 수동배치 탭에 특정 종목 코드 입력과 `특정 종목 재집계` 버튼을 추가했다.

## 실제 재집계 결과
- 2026-05-17 BSAC 실제 DB 재집계 완료.
- close_price: 30.18
- market_cap: 14,218,260,266.6073 USD
- shares_outstanding: 471,115,316.985 ADS-equivalent shares
- equity: 6,194,619,322.64 USD
- net_income: 890,620,346.72 USD
- PER: 15.9644
- PBR: 2.2953
- ROE: 14.3773%
- source에 `adr_share_ratio: 400`, `financial_currency: CLP`, `fx_source: stooq/CLPUSD`를 기록한다.

## 검증
- `python -m compileall batch\update_metrics.py batch\update_watchlist_prices.py`
- `python batch/update_metrics.py --market US --codes BSAC` equivalent local env execution
- DB 최신 BSAC row 확인
- `npm run lint`
- `npm run build`

## 다음 에이전트 인수인계
- BSAC 문제는 ADS ratio 400 및 CLP->USD 환산으로 해결됐다.
- 추가 ADR/ADS 종목에서 유사한 문제가 발견되면 `ADR_SHARE_RATIO`에 해당 ADS:원주 비율을 추가해야 한다.
- 장기적으로는 SEC F-6/20-F에서 ADS ratio를 자동 추출하는 보조 수집기를 만들면 수동 mapping을 줄일 수 있다.
