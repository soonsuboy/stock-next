# 0043 - 전체 집계기업 가격 배치 스케줄과 관리자 설정

## 요청
- 전체 주식의 가격을 아침마다 집계해야 전체적인 상한가/하한가를 알 수 있다.
- 재무제표를 주기적으로 가져오는 배치와 가격을 주기적으로 가져오는 배치를 관리자 페이지 `배치설정` 탭에서 조회하고 주기나 배치 횟수를 설정할 수 있게 한다.

## 계획
1. 기존 관심종목 가격 배치와 별도로, `metrics_history`에 집계된 전체 기업의 가격/전일가격/등락률을 갱신하는 스케줄을 추가한다.
2. `batch_settings`에 전체 가격 배치 활성화, 실행 시간, 대상 시장, 1회 처리 건수, 마지막 실행 상태를 저장한다.
3. 관리자 `배치설정` 탭을 재무제표 수집 배치와 가격/등락률 수집 배치로 나눠 보여준다.
4. 기존 배포/스케줄 환경에서 새 설정 키가 자동으로 생성되도록 마이그레이션과 런타임 기본값을 모두 갱신한다.

## 구현 내용
- `batch/run_scheduled.py`
  - `metric_price_enabled`
  - `metric_price_time_kst`
  - `metric_price_market`
  - `metric_price_limit`
  - `last_metric_price_*`
  설정을 추가했다.
- 스케줄러가 매일 설정 시간 이후 `batch/update_watchlist_prices.py --scope metrics --market <시장>`을 실행하도록 했다.
- `metric_price_limit`이 0이면 전체 실행, 1 이상이면 해당 건수만 처리한다.
- `metric_price_market`은 `ALL`, `KR`, `US`를 지원한다.
- 기존 관심종목 가격 배치(`watchlist_price_*`)는 그대로 유지했다.
- `lib/batch-settings.ts`에 새 설정과 마지막 실행 메타 타입, 파싱, 저장 로직을 추가했다.
- `batch/migrate_db.py` 기본 설정에도 새 키를 추가했다.
- 관리자 `배치설정` 탭에서:
  - 재무/기업 배치: 실행 시간, 허용 시간, 기업 마스터, 한국 재무, 미국 재무, 처리 건수, shard 수, 자동 배치 대상
  - 가격/등락률 배치: 전체 집계기업 가격 배치 활성화, 실행 시간, 대상 시장, 1회 처리 건수, 관심종목 가격 배치 설정
  을 분리해서 관리하도록 했다.

## 수정 파일
- `batch/run_scheduled.py`
- `batch/migrate_db.py`
- `lib/batch-settings.ts`
- `app/admin/AdminDashboard.tsx`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0043-admin-metric-price-schedule.md`

## 검증
- `npm run lint`
- `npm run build`
- `python -m py_compile batch/run_scheduled.py batch/migrate_db.py batch/update_watchlist_prices.py`
- `python batch/migrate_db.py`
- Turso `batch_settings`에서 `metric_price_*`, `last_metric_price_*` 키 생성 확인

## 다음 에이전트 인수인계
- GitHub Actions는 15분마다 `batch/run_scheduled.py`를 실행한다.
- 전체 집계기업 가격 배치 기본값은 매일 `07:00 KST`, 대상 `ALL`, 처리 건수 `0`(전체)이다.
- 상한가/하한가 필터는 이 전체 가격 배치가 채운 `metrics_history.previous_close`, `metrics_history.change_rate`를 사용한다.
- 처리 시간이 길면 관리자에서 `metric_price_limit`을 조정할 수 있지만, 0이 아니면 전체 종목이 매일 모두 갱신되지는 않는다.
