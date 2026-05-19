# 0044 - 전체 집계기업 가격 배치 수동 실행

## 요청
- 지금 재무제표와 가격이 있는 모든 주식에 대해 오늘자 가격을 가져와 등락률을 보여주도록 수동 배치를 실행한다.

## 판단
- 전체 집계기업 가격 갱신은 한국/미국 수천 종목을 조회하므로 로컬 실행보다 GitHub Actions에서 실행하는 것이 안전하다.
- 기존 workflow 수동 실행에는 관심종목 가격 배치(`watchlist_prices`)만 있고 전체 집계기업 가격 배치(`--scope metrics`) 모드가 없었다.

## 구현 내용
- `.github/workflows/stock-batch.yml`에 `metric_prices` 수동 실행 모드를 추가했다.
- `metric_prices`는 다음 명령을 실행한다.

```bash
python batch/update_watchlist_prices.py --scope metrics --market ALL
```

- `lib/github-actions.ts`의 workflow dispatch 타입에도 `metric_prices` 모드를 추가했다.

## 실행 예정/실행 방식
- 변경사항을 `main`에 푸시한 뒤 GitHub Actions workflow를 `mode=metric_prices`로 수동 dispatch한다.
- 오늘자 가격은 각 가격 소스의 최신값을 의미한다.
  - 한국: Daum Finance 최신 거래/종가 데이터
  - 미국: Stooq 최신 close/prev 데이터. 한국 시간 저녁에는 미국 당일 장 마감 전이므로 최신 확정 종가는 직전 거래일 기준일 수 있다.

## 수정 파일
- `.github/workflows/stock-batch.yml`
- `lib/github-actions.ts`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0044-dispatch-metric-price-batch.md`

## 검증
- `npm run lint`
- `npm run build`

## 다음 에이전트 인수인계
- GitHub Actions 실행이 끝나면 `batch_runs`에서 `job_name=update_metric_prices` 또는 workflow 실행 로그를 확인한다.
- 전체 실행은 시간이 오래 걸릴 수 있다. 필요하면 다음에는 `limit`을 지정해 시장별로 나눠 실행하는 입력을 추가할 수 있다.
