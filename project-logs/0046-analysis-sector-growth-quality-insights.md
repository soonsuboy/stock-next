# 0046 - Analysis Sector Growth Quality Insights

## Request

- 투자 인사이트를 얻기 위해 제안했던 “섹터 내 상대평가 + 성장률 추세 + 퀄리티 점수”를 단계적으로 개발한다.

## Plan

1. 현재 재무 데이터 구조에서 안정적으로 계산 가능한 항목을 확인한다.
2. `metrics_history`, `companies.gics_sector` 기반으로 섹터 비교군을 만들고 PER/PBR/ROE 중앙값과 우호 분위수를 계산한다.
3. 종목별 과거 `bsns_year` 기준 재무 이력으로 전년 대비 순이익, 영업이익, 자본 성장률을 계산한다.
4. ROE, 부채비율, 이익의 질, 성장 지속성을 합산해 100점 기준 퀄리티 점수를 만든다.
5. 분석 API와 분석 대시보드에 새 인사이트 패널을 추가한다.

## Implementation

- `lib/investment-insights.ts`를 추가해 투자 인사이트 계산 로직을 분리했다.
- 섹터 내 상대평가:
  - 같은 국가와 같은 GICS 섹터의 최신 지표를 비교군으로 사용한다.
  - PER/PBR은 낮을수록 우호적인 분위로 계산한다.
  - ROE는 높을수록 우호적인 분위로 계산한다.
  - 각 지표에 내 값, 섹터 중앙값, 우호 분위, 해석 라벨을 제공한다.
- 성장률 추세:
  - 같은 종목의 `bsns_year`별 최신 스냅샷을 기준으로 최근 연도와 직전 연도를 비교한다.
  - 순이익 성장률, 영업이익 성장률, 자본 성장률을 계산한다.
  - 성장 우위, 혼합 성장, 감소 추세, 이력 부족 라벨을 제공한다.
- 퀄리티 점수:
  - 수익성(ROE) 35점, 재무 안정성(부채비율) 25점, 이익의 질 20점, 성장 지속성 20점으로 구성했다.
  - 총점에 따라 A/B/C/D/E 등급을 제공한다.
- `/api/watchlist/analysis` 응답에 `operating_income`, `total_liabilities`, `debt_ratio`, `insights`를 추가했다.
- 분석 대시보드에 “투자 인사이트” 패널을 추가했다.
- 분석 캐시 키를 `analysis:v2`로 올려 기존 캐시가 새 응답 구조를 가리지 않게 했다.

## Modified Files

- `lib/investment-insights.ts`
- `app/api/watchlist/analysis/route.ts`
- `app/analysis/page.tsx`
- `app/watchlist/page.tsx`
- `app/search/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 현재 DB에는 매출액이 없어서 매출 성장률, 영업이익률, 순이익률, FCF 같은 지표는 아직 계산하지 않았다.
- 다음 단계로 매출/현금흐름을 배치에서 수집하면 퀄리티 점수를 더 정교하게 만들 수 있다.
- 검색 그리드에도 이 점수를 노출하거나 필터로 추가하면 투자 후보 탐색 기능이 더 강해진다.
