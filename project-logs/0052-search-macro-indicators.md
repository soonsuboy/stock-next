# 0052 - Search Macro Indicators

## Request

- 종목검색 메뉴에서 매일 당일의 거시 지표를 보고 싶다.
- 표시 지표:
  - 원/달러 환율
  - 코스피 외국인 순매도/순매수
  - 국내증시 투자자 총 예탁금
  - 증권사 대출/신용거래융자 총액
  - 예탁금 대비 신용융자 비율
  - 비율이 30%를 넘으면 과열구간 표시
  - 국내, 미국, 비트코인 공포탐욕지수

## Implementation

- `macro_indicators` 테이블을 추가했다.
  - `snapshot_date + indicator_key` 기준으로 날짜별 지표를 저장한다.
  - 지표값, 표시값, 출처, 상태, 비고를 같이 저장한다.
- `batch/update_macro_indicators.py`를 추가했다.
  - 원/달러 환율: Stooq `USDKRW` CSV
  - 코스피 외국인 순매수: Naver Finance 일자별 순매수 표
  - 투자자 예탁금/신용잔고: Naver Finance 증시자금동향
  - 예탁금 대비 신용융자 비율: 앱 내부 계산
  - 국내 공포탐욕: 앱 자체 산출값
    - 신용융자/예탁금 비율 60%
    - 코스피 외국인 순매수 40%
  - 미국 공포탐욕: `feargreedchart.com` 공개 API
  - 비트코인 공포탐욕: `alternative.me` Fear & Greed API
- Naver 예탁금/신용잔고 수집 실패 시 사용자가 알려준 예탁금 130조, 신용융자 38조를 fallback 값으로 저장하도록 했다.
- `batch/run_scheduled.py`에 거시 지표 일일 스케줄을 추가했다.
  - 기본 실행 시각: 매일 08:00 KST
  - `batch_settings`에 `macro_indicator_*`, `last_macro_indicator_*` 키를 추가했다.
- GitHub Actions workflow에 `macro` 수동 실행 모드를 추가했다.
- `GET /api/macro-indicators`를 추가했다.
  - 로그인 사용자만 호출할 수 있다.
  - 각 지표별 최신 row를 반환한다.
- `app/search/page.tsx` 상단에 `오늘의 거시 지표` 패널을 추가했다.
  - 환율/수급/예탁금/신용융자/비율을 첫 줄에 표시한다.
  - 국내/미국/비트코인 공포탐욕지수를 둘째 줄에 표시한다.
  - 신용융자 비율 30% 이상이면 과열 badge로 표시한다.
  - 국내 공포탐욕은 공식 지수가 아니라 자체 산출값임을 명시했다.

## Current Collected Sample

- 원/달러 환율: 1,529.75원
- 코스피 외국인 순매수: -6.67조원 순매도
- 투자자 총 예탁금: 136.81조원
- 신용거래융자 총액: 37.11조원
- 예탁금 대비 신용융자 비율: 27.12% 정상
- 국내 공포탐욕지수: 47 / 100 중립
- 미국 공포탐욕지수: 69 / 100 탐욕
- 비트코인 공포탐욕지수: 12 / 100 Extreme Fear

## Modified Files

- `.github/workflows/stock-batch.yml`
- `app/api/macro-indicators/route.ts`
- `app/search/page.tsx`
- `batch/migrate_db.py`
- `batch/run_scheduled.py`
- `batch/update_macro_indicators.py`
- `lib/batch-settings.ts`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `python batch/update_macro_indicators.py --dry-run` passed.
- `python batch/update_macro_indicators.py` completed and wrote 8 indicators.
- `python batch/migrate_db.py` completed.
- `python -m py_compile batch/migrate_db.py batch/run_scheduled.py batch/update_macro_indicators.py` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local `/search` route responded with HTTP 200.

## Handoff Notes

- 국내 공포탐욕지수는 공식 지수가 아니라 앱 자체 산출값이다. UI에도 이 점을 명시했다.
- Naver Finance HTML 구조가 바뀌면 코스피 외국인 순매수, 예탁금, 신용잔고 수집이 깨질 수 있다.
- 예탁금/신용잔고 수집 실패 시 fallback 값은 130조/38조로 저장된다. 이 fallback은 화면에서 `대체값` 상태로 구분된다.
- 관리자가 거시 지표 실행 시간까지 UI에서 바꾸려면 관리자 배치설정 탭에 `macroIndicatorEnabled`, `macroIndicatorTimeKst` 컨트롤을 추가하면 된다.
