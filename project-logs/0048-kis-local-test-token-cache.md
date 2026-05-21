# 0048 - KIS Local Test Token Cache

## Request

- `.env.local`에 한국투자증권 KIS API 키를 저장했으니 실제 조회를 테스트한다.

## Result

- `.env.local`에서 `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ENV`, `KIS_REQUEST_DELAY_SECONDS`가 정상 로드되는 것을 확인했다.
- 단건 quote 테스트에서 KIS가 1순위 provider로 정상 동작했다.
  - `KR:005930` source: `kis`
  - `US:AAPL` source: `kis`
- 이후 배치 dry-run에서 새 Python 프로세스가 KIS 토큰을 다시 발급받으며 `403 Forbidden`이 발생했다.
- KIS 토큰 발급을 너무 자주 호출하지 않도록 로컬/배치 공용 파일 토큰 캐시를 추가했다.

## Implementation

- `batch/kis_client.py`
  - `.cache/kis_token_<env>.json`에 access token과 만료시각을 저장한다.
  - 같은 로컬 실행이나 같은 GitHub Actions run 안에서 여러 Python 프로세스가 토큰을 재사용할 수 있게 했다.
  - `KIS_ACCESS_TOKEN`, `KIS_ACCESS_TOKEN_EXPIRES_AT` 환경변수를 수동 override로 지원한다.
- `.gitignore`
  - `.cache/`를 추가해 KIS 토큰 캐시 파일이 Git에 올라가지 않게 했다.

## Validation

- `python -m py_compile batch\\kis_client.py batch\\update_metrics.py batch\\update_watchlist_prices.py batch\\db.py` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Handoff Notes

- 최초 KIS 단건 조회는 성공했으나, 그 직후 반복 토큰 발급이 막혀 dry-run 일부가 fallback으로 내려갔다.
- 이번 수정 이후에는 다음번 성공적인 토큰 발급부터 `.cache/`에 저장되어 같은 실행 환경에서 재사용된다.
- 만약 KIS가 당일 중복 토큰 발급을 계속 막는다면 일정 시간 후 또는 다음 영업일에 다시 dry-run하면 된다.
