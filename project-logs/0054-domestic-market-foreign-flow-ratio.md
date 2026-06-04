# 0054 - Domestic Market Foreign Flow Ratio

## Request

- 외국인 순매도/순매수를 코스피 단독이 아니라 국내시장 전체 기준으로 보고 싶다.
- 국내시장 전체에서 차지하는 비율도 표기하고 싶다.
- 하루하루 변동폭도 알 수 있게 하고 싶다.

## Implementation

- `batch/update_macro_indicators.py`를 확장했다.
  - Naver Finance 투자자별 매매동향에서 코스피(`sosok=01`)와 코스닥(`sosok=02`) 외국인 순매수액을 각각 수집한다.
  - Naver Finance 지수 페이지에서 코스피와 코스닥 거래대금(백만원)을 각각 수집한다.
  - 국내시장 전체 지표를 코스피+코스닥 합산으로 계산한다.
- 새 거시지표 3개를 추가했다.
  - `kr_market_foreign_net_buy`: 국내시장 전체 외국인 순매수액
  - `kr_market_foreign_net_buy_ratio`: 외국인 순매수액 / 코스피+코스닥 거래대금
  - `kr_market_foreign_net_buy_change`: 전 거래일 대비 외국인 순매수액 변동폭
- 국내 공포탐욕지수 산출 설명을 코스피 단독에서 국내시장 전체 외국인 순매수 기준으로 수정했다.
- `app/search/page.tsx`의 거시지표 패널을 수정했다.
  - 기존 화면 노출은 `코스피 외국인 순매수` 대신 국내시장 전체 외국인 순매수, 비율, 전일대비 변동폭으로 바꿨다.
  - `순매수`, `순매도` badge를 추가했다.
  - 순매수는 빨간 계열, 순매도는 파란 계열로 표시한다.

## Current Collected Sample

- 국내시장 외국인 순매수: -6.71조원 순매도
- 외국인 순매수 비율: -11.43% 순매도
- 외국인 순매수 전일대비: -7,453억원 매도 방향
- 세부:
  - 코스피 -6.67조원 순매도, 거래대금 47.64조원
  - 코스닥 -424억원 순매도, 거래대금 11.05조원

## Modified Files

- `app/search/page.tsx`
- `batch/update_macro_indicators.py`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `python batch/update_macro_indicators.py --dry-run` passed.
- `python batch/update_macro_indicators.py` completed and wrote 15 macro indicators.
- DB sample rows confirmed for `kr_market_foreign_net_buy`, `kr_market_foreign_net_buy_ratio`, `kr_market_foreign_net_buy_change`.
- `python -m py_compile batch/update_macro_indicators.py batch/run_scheduled.py batch/migrate_db.py` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 국내시장 전체는 현재 코스피+코스닥 합산이다.
- 순매수 비율의 분모는 코스피+코스닥 지수 페이지의 당일 거래대금 합계다.
- 전일대비 변동폭은 투자자별 매매동향 표의 최신 거래일과 직전 거래일 외국인 순매수액 차이다.
- 기존 `kospi_foreign_net_buy` 지표는 DB와 내부 호환을 위해 계속 수집하지만, 화면에는 국내시장 전체 지표를 우선 표시한다.
