# 0058 - Grouped Macro Cards And Sparklines

## Request

- 거시지표에서 같이 해석해야 하는 값들을 한 카드로 묶어 보여주고 싶다.
- 외국인 순매수 금액과 비율을 한 카드로 붙인다.
- 총예탁금, 신용거래융자 총액, 비율을 한 카드로 붙인다.
- 외환보유액, 전월대비 변동액, 변동율도 한 카드로 붙인다.
- 매일 집계되는 거시지표 중 그래프로 보여줄 수 있는 값은 작은 그래프로 보여주고 싶다.

## Implementation

- `GET /api/macro-indicators` 응답에 `history` 배열을 추가했다.
  - 최근 180일 내 `macro_indicators` 값 중 숫자값이 있는 지표를 반환한다.
  - 화면에서는 지표별 최근 30개 값을 미니그래프로 사용한다.
- `app/search/page.tsx`의 거시지표 패널을 그룹형 카드로 재구성했다.
  - `환율과 외환시장`
    - 원/달러 환율
    - 서울외환시장 달러 거래량
  - `외국인 수급`
    - 국내시장 외국인 순매수 금액
    - 거래대금 대비 비율
    - 전일대비 변동폭
  - `예탁금과 신용융자`
    - 투자자 총 예탁금
    - 신용거래융자 총액
    - 신용융자/예탁금 비율
  - `외환보유액`
    - 외환보유액
    - 전월대비 변동액
    - 전월대비율
  - `공포탐욕지수`
    - 국내
    - 미국
    - 비트코인
- 외부 차트 라이브러리 없이 SVG sparkline 컴포넌트를 추가했다.
  - 이력이 2개 미만이면 `이력 부족`으로 표시한다.
  - 순매수/폭증/과열은 빨간 계열, 순매도/감소는 파란 계열, 일반 지표는 초록 계열로 표시한다.
- 브라우저 캐시 키를 `search:macro-indicators:v2`로 올려 기존 캐시와 충돌하지 않게 했다.

## Modified Files

- `app/api/macro-indicators/route.ts`
- `app/search/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- DB 이력 쿼리로 `macro_indicators`에 그래프용 값이 존재하는 것을 확인했다.

## Handoff Notes

- 미니그래프는 최근 180일 안의 값 중 지표별 최근 30개를 사용한다.
- 외환보유액처럼 월 1회 집계되는 지표는 이력이 충분히 쌓이기 전까지 `이력 부족`으로 보일 수 있다.
- `macro_indicators`에 더 긴 기간의 추세를 보여주고 싶으면 API의 날짜 조건을 조정하면 된다.
