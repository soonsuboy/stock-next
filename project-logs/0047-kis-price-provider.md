# 0047 - KIS Price Provider

## Request

- 한국투자증권 KIS Open API 키를 발급받아 가격 데이터를 1순위로 업데이트하는 방향으로 개발한다.
- 로컬 테스트를 위해 `.env.local`에도 필요한 환경변수를 추가한다.
- GitHub Actions Secrets/Variables에 어떤 값을 추가해야 하는지 안내한다.

## Plan

1. KIS 공식 포털과 공식 샘플 저장소 기준으로 REST 인증/시세 조회 흐름을 확인한다.
2. 가격 수집 배치에서 KIS를 1순위 provider로 사용하고 실패 시 기존 Daum/Stooq fallback을 유지한다.
3. 로컬 배치가 `.env.local`을 읽을 수 있도록 공통 환경변수 로더를 추가한다.
4. GitHub Actions workflow에 KIS 환경변수를 전달한다.
5. Python 구문 검사, Next lint/build로 검증한다.

## Implementation

- `batch/kis_client.py`를 추가했다.
  - `/oauth2/tokenP`로 접근토큰을 발급받는다.
  - 국내주식 현재가 API `/uapi/domestic-stock/v1/quotations/inquire-price`를 호출한다.
  - 해외주식 현재체결가 API `/uapi/overseas-price/v1/quotations/price`를 호출한다.
  - `KIS_REQUEST_DELAY_SECONDS`로 간단한 호출 간격 제한을 둔다.
- `batch/update_metrics.py`에 `fetch_best_quote()`를 추가했다.
  - 1순위: KIS
  - KIS 미설정/실패/가격 없음: 한국은 Daum, 미국은 Stooq fallback
- `batch/update_watchlist_prices.py`가 `fetch_best_quote()`를 사용하도록 바꿨다.
  - 관심종목 가격 배치와 전체 집계기업 가격 배치 모두 KIS를 우선 사용한다.
- `batch/db.py`가 로컬 `.env.local`을 읽도록 추가했다.
  - 이미 설정된 환경변수는 덮어쓰지 않는다.
  - GitHub Actions에서는 기존 secrets/env가 우선이다.
- `.github/workflows/stock-batch.yml`에 KIS 관련 env 전달을 추가했다.
- 로컬 `.env.local`에는 다음 키를 추가했다. 이 파일은 `.gitignore` 대상이라 커밋되지 않는다.
  - `KIS_APP_KEY`
  - `KIS_APP_SECRET`
  - `KIS_ENV`
  - `KIS_REQUEST_DELAY_SECONDS`

## Modified Files

- `batch/kis_client.py`
- `batch/db.py`
- `batch/update_metrics.py`
- `batch/update_watchlist_prices.py`
- `.github/workflows/stock-batch.yml`
- `.env.local` ignored local file
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `python -m py_compile batch\\kis_client.py batch\\update_metrics.py batch\\update_watchlist_prices.py batch\\db.py` passed.
- KIS 키가 비어 있는 로컬 상태에서 `fetch_best_quote('KR', '005930')`가 Daum fallback으로 정상 조회됨을 확인했다.
- `npm run lint` passed.
- `npm run build` passed.

## GitHub Secrets/Variables

Repository → Settings → Secrets and variables → Actions에서 추가한다.

Secrets:

- `KIS_APP_KEY`: KIS Developers에서 발급받은 실전투자 App Key
- `KIS_APP_SECRET`: KIS Developers에서 발급받은 실전투자 App Secret

Variables:

- `KIS_ENV`: `real`
- `KIS_REQUEST_DELAY_SECONDS`: `0.12`
- `KIS_BASE_URL`: 비워둬도 됨. 특수한 경우에만 `https://openapi.koreainvestment.com:9443` 같은 값을 입력

## Handoff Notes

- KIS 키가 없는 환경에서는 기존 Daum/Stooq fallback이 계속 동작한다.
- KIS 해외주식은 거래소 코드가 필요하므로 `companies.market` 값을 기준으로 NASDAQ/NYSE/AMEX를 각각 `NAS`/`NYS`/`AMS`로 변환한다.
- 실제 KIS 키 입력 후에는 `python batch/update_watchlist_prices.py --scope metrics --market KR --limit 5 --dry-run`으로 먼저 확인한다.
