# 0041 - 전일대비 등락률 배치 즉시 실행

## 요청
- 상한가/하한가 필터가 보이도록 다음 배치를 지금 실행해 전일 종가와 등락률 데이터를 채운다.

## 원인 확인
- `metrics_history` 전체 7,105건 중 `previous_close`, `change_rate`가 모두 비어 있었다.
- 종목검색 상한가/하한가 필터는 `change_rate >= 28` 또는 `change_rate <= -28` 조건으로 조회하므로, 등락률이 `NULL`이면 필터에 걸리지 않는다.

## 계획
1. 기존 스키마 마이그레이션을 먼저 실행한다.
2. 재무제표를 다시 수집하지 않고, 기존 최신 `metrics_history` 행의 재무값을 복사하면서 가격/전일 종가/등락률/시가총액만 갱신하는 모드를 추가한다.
3. 한국 집계 기업 전체를 먼저 갱신한다.
4. 미국 집계 기업은 시간이 오래 걸리므로 실행 가능한 만큼 갱신하고, 관리자 로그가 `running`으로 남지 않게 정리한다.
5. 결과 건수와 +28% 이상 필터 대상이 실제로 생겼는지 확인한다.

## 구현 내용
- `batch/update_watchlist_prices.py`에 `--scope metrics` 옵션을 추가했다.
  - 기본값은 기존 동작과 같은 `watchlist`라서 기존 스케줄 배치에는 영향이 없다.
  - `--scope metrics`는 최신 `metrics_history` 행을 대상으로 가격만 갱신한다.
- `--missing-change-only` 옵션을 추가해 `previous_close` 또는 `change_rate`가 비어 있는 행만 처리할 수 있게 했다.
- 실행 중 타임아웃된 미국 가격 갱신 배치의 `batch_runs` 상태를 `partial`로 정리했다.

## 실행 결과
- `python batch/migrate_db.py`
  - 성공: `DB migration completed`
- `python batch/update_watchlist_prices.py --scope metrics --market KR --missing-change-only`
  - 처리: 1,570개
  - 성공: 1,399개
  - 실패: 171개
  - 실패 사유: Daum quote에서 최신 가격을 찾지 못한 오래된 코드/비정상 코드 중심
- `python batch/update_watchlist_prices.py --scope metrics --market US --missing-change-only`
  - 로컬 실행 제한 시간으로 중단
  - 중간 저장 기준 처리: 800개
  - 성공: 747개
  - 실패: 53개
  - `batch_runs`는 `partial`로 정리

## 데이터 확인
- 최신 스냅샷 기준:
  - 한국: 1,399개에 `previous_close`, `change_rate` 반영
  - 미국: 747개에 `previous_close`, `change_rate` 반영
- +28% 이상 필터 대상:
  - 한국: 5개
  - 미국: 5개
- -28% 이하 필터 대상:
  - 현재 확인 시점에는 0개

## 확인된 상한가 예시
- KR `011000` 진원생명과학: 약 +29.97%
- KR `004870` 티웨이홀딩스: 약 +29.96%
- KR `021880` 메이슨캐피탈: 약 +29.95%
- KR `035620` 바른손이앤에이: 약 +29.94%
- KR `018700` 졸스: 약 +29.75%

## 수정 파일
- `batch/update_watchlist_prices.py`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0041-run-price-change-backfill.md`

## 검증
- `python -m py_compile batch/update_watchlist_prices.py`
- `python batch/migrate_db.py`
- DB 직접 조회로 `previous_close`, `change_rate`, `+28% 이상` 건수 확인

## 다음 에이전트 인수인계
- 미국 전체 3,985개 중 747개만 이번에 가격 변화율이 채워졌다.
- 남은 미국 종목은 다음 명령으로 이어서 처리할 수 있다.

```powershell
python batch/update_watchlist_prices.py --scope metrics --market US --missing-change-only --limit 800
```

- 전체를 한 번에 처리하면 Stooq 요청 속도 때문에 로컬에서는 오래 걸릴 수 있으므로 500~800개 단위로 나누는 것이 좋다.
