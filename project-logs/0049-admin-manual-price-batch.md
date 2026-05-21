# 0049 - Admin Manual Price Batch

## Request

- 관리자 수동배치에 DB에 이미 적재되어 있는 기업들의 가격만 가져오는 버튼을 추가한다.
- 한국투자증권 KIS API가 미국 주식 가격도 가져오는지 확인한다.

## Implementation

- 관리자 수동배치 탭에 `DB 적재기업 가격만 갱신` 버튼을 추가했다.
- 새 API `POST /api/admin/trigger-price-batch`를 추가했다.
  - 재무제표 수집이 아니라 GitHub Actions `metric_prices` 모드만 호출한다.
  - `metrics_history`에 이미 있는 기업들의 최신 가격, 전일종가, 등락률, 시가총액 재계산만 수행한다.
  - 수동 배치의 `가져올 기업 수` 입력값을 그대로 사용한다.
- GitHub Actions workflow에 `price_market` 입력을 추가했다.
  - 기본값은 `ALL`
  - `metric_prices` 실행 시 `batch/update_watchlist_prices.py --scope metrics --market <price_market>`로 전달한다.
- `lib/github-actions.ts` dispatch payload에 `price_market`을 추가했다.

## KIS US Price Support

- KIS provider는 국내 주식뿐 아니라 미국 주식도 지원한다.
- 구현된 해외주식 경로는 KIS 해외주식 현재체결가 REST API이며, `companies.market` 값을 기준으로 NASDAQ/NYSE/AMEX를 각각 `NAS`/`NYS`/`AMS`로 변환해서 호출한다.
- 미국 주식도 가격, 전일종가, 등락률, 거래량을 KIS에서 우선 가져오고 실패 시 Stooq fallback으로 내려간다.

## Modified Files

- `app/admin/AdminDashboard.tsx`
- `app/api/admin/trigger-price-batch/route.ts`
- `lib/github-actions.ts`
- `.github/workflows/stock-batch.yml`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 현재 버튼은 `ALL` 기준으로 가격 배치를 요청한다.
- 시장별로 나눠 실행하는 UI가 필요하면 `price_market` 값을 KR/US로 선택하는 컨트롤을 추가하면 된다.
- 배치 실제 실행은 Vercel 함수가 아니라 GitHub Actions에서 이루어지므로 Vercel 함수 사용량 부담은 거의 없다.
