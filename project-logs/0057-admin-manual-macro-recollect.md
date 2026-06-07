# 0057 - Admin Manual Macro Recollection

## Request

- 관리자에서 거시지표들을 모두 한 번에 재수집하는 버튼을 만들고 싶다.

## Implementation

- 관리자 수동배치 탭에 `거시지표 전체 재수집` 버튼을 추가했다.
  - 버튼은 기존 수동배치와 동일하게 `GITHUB_ACTIONS_TOKEN` 설정 여부를 따른다.
  - Vercel 함수에서 직접 외부 데이터를 수집하지 않고 GitHub Actions workflow를 dispatch한다.
- `app/api/admin/trigger-macro-batch/route.ts`를 추가했다.
  - 관리자만 호출할 수 있다.
  - `batch_runs`에 `update_macro_indicators` 요청 row를 먼저 남긴다.
  - GitHub Actions `stock-batch.yml`의 `macro` mode를 실행한다.
- `lib/github-actions.ts`의 workflow dispatch mode 타입에 `macro`를 추가했다.
- `.github/workflows/stock-batch.yml`의 `macro` mode에 `request_id`와 `dry_run` 전달을 추가했다.
- `batch/update_macro_indicators.py`에 `--run-id`를 추가했다.
  - 실행 시작 시 `batch_runs.status = running`으로 갱신한다.
  - 수집 성공 시 처리/성공/실패 건수와 `success` 또는 `partial` 상태를 남긴다.
  - 예외 발생 시 `failed` 상태와 오류 샘플을 남긴다.
- 관리자 버튼 클릭 후 종목검색 거시지표 브라우저 캐시(`search:macro-indicators:v1`)를 삭제하도록 했다.

## Modified Files

- `.github/workflows/stock-batch.yml`
- `app/admin/AdminDashboard.tsx`
- `app/api/admin/trigger-macro-batch/route.ts`
- `batch/update_macro_indicators.py`
- `lib/github-actions.ts`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `python -m py_compile batch/update_macro_indicators.py` passed.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

## Handoff Notes

- 실제 버튼 실행은 배포/로컬 환경에 `GITHUB_ACTIONS_TOKEN` 또는 `GITHUB_PAT`가 있어야 가능하다.
- workflow가 완료되면 관리자 `최근 배치 실행` 탭에서 `update_macro_indicators` 실행 결과를 확인할 수 있다.
- `macro` mode는 환율, 서울외환시장 거래량, 외환보유액, 국내시장 외국인 수급, 예탁금/신용융자, 공포탐욕지수를 한 번에 다시 수집한다.
