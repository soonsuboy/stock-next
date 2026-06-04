# 0053 - Seoul FX Volume And Reserves Macro Indicators

## Request

- 종목검색의 거시지표에 서울외환시장의 일일 달러 거래량을 추가한다.
- 평시 100억~130억달러를 크게 상회하면 거래량 폭증으로 볼 수 있게 한다.
- 한국은행이 발표하는 우리나라 외환보유액을 거시지표에 추가한다.
- 외환보유액은 전월대비 변동액과 변동율도 같이 표기한다.

## Implementation

- `batch/update_macro_indicators.py`를 확장했다.
  - `seoul_fx_usd_volume`
    - 한국무역보험공사/연합인포맥스 `FX Market Daily` 공개 PDF의 `전일 현물환 거래량(종합)` 값을 파싱한다.
    - 값은 달러 기준 실제 금액으로 저장하고, 화면 표시값은 `억달러`로 보여준다.
    - 150억달러 이상이면 `status = surge`로 저장한다.
  - `fx_reserves_total`
    - 한국은행 ECOS `732Y001` 외환보유액 통계의 `합계(99)` 월별 데이터를 조회한다.
    - ECOS 키는 `BOK_API_KEY` 또는 `ECOS_API_KEY`를 우선 사용하고, 없으면 제한된 `sample` 키로 최근 10개월 범위만 조회한다.
  - `fx_reserves_mom_change`
    - 최신 월말 외환보유액과 전월 값을 비교해 변동액을 계산한다.
  - `fx_reserves_mom_rate`
    - 전월대비 변동율을 계산한다.
- `requirements.txt`에 `pypdf`를 추가했다.
  - GitHub Actions 배치에서 `FX Market Daily` PDF 텍스트를 추출하기 위해 필요하다.
- `.github/workflows/stock-batch.yml`에 `BOK_API_KEY` secret 연결을 추가했다.
  - Secret이 없어도 샘플 키로 제한 조회가 가능하지만, 운영 안정성을 위해 GitHub Actions secret 등록을 권장한다.
- `app/search/page.tsx`의 거시지표 패널을 확장했다.
  - 서울외환시장 거래량, 외환보유액, 외환보유액 전월대비 변동액/변동율 타일을 추가했다.
  - `폭증`, `감소` 상태 badge를 추가했다.
  - 서울외환시장 거래량은 150억달러 이상이면 빨간색 `폭증`으로 표시한다.

## Current Collected Sample

- 서울외환시장 달러 거래량: 173.44억달러, 폭증
- 외환보유액: 4,269.94억달러
- 외환보유액 전월대비: -8.82억달러
- 외환보유액 전월대비율: -0.21%

## Modified Files

- `.github/workflows/stock-batch.yml`
- `app/search/page.tsx`
- `batch/update_macro_indicators.py`
- `requirements.txt`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `python batch/update_macro_indicators.py --dry-run` passed.
- `python batch/update_macro_indicators.py` completed and wrote 12 macro indicators.
- DB sample rows confirmed for `seoul_fx_usd_volume`, `fx_reserves_total`, `fx_reserves_mom_change`, `fx_reserves_mom_rate`.
- `python -m py_compile batch/update_macro_indicators.py batch/run_scheduled.py batch/migrate_db.py` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 외환보유액은 공식 한국은행 ECOS 통계표 `732Y001`을 사용한다.
- `BOK_API_KEY`가 없으면 ECOS `sample` 키로 제한 조회한다. 운영 배치에서는 GitHub Actions secret에 `BOK_API_KEY`를 추가하는 편이 안전하다.
- 서울외환시장 일별 거래량은 ECOS 일별 테이블을 찾지 못해 `FX Market Daily` 공개 PDF를 보조 출처로 사용했다.
- `KSURE_FX_DAILY_START_ID`, `KSURE_FX_DAILY_SCAN_WINDOW` 환경변수로 PDF 검색 시작 ID와 스캔 범위를 조정할 수 있다.
- 현재 기본 ID 추정 기준은 `2026-06-04 = #3657`이며, 영업일 기준으로 주변 PDF를 역순 탐색한다.
