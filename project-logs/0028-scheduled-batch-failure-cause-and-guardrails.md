# 0028 - Scheduled batch failure cause and guardrails

## 요청
- 관리자 페이지에 표시된 scheduled batch 실패 원인을 확인한다.
- 실패 내역:
  - started: 2026-05-17 22:59:01 KST
  - completed: 2026-05-17 22:59:18 KST
  - job: `scheduled_batch`
  - error: `batch/update_companies.py --market ALL` returned non-zero exit status 1

## 확인
- GitHub Actions API로 run을 확인했다.
  - failing run: `25992862559`
  - commit: `c587d2b`
  - failing step: `Run scheduled batch`
  - run log download은 GitHub API에서 admin 권한이 필요해 원문 stderr는 직접 받을 수 없었다.
- 로컬에서 현재 환경변수로 `python batch/update_companies.py --market ALL --dry-run`은 정상:
  - KR companies: 3965
  - US companies: 4155
- 로컬에서 실제 write도 정상 완료:
  - Inserted/updated companies: 8120
- DB 설정 확인:
  - `schedule_time_kst=08:00`
  - `schedule_window_minutes=60`
  - 실패 시각은 22:59 KST로 실행 허용 시간보다 약 14시간 늦다.

## 원인 판단
- 기존 `batch/run_scheduled.py`는 `schedule_window_minutes`를 넘겨도 `late schedule execution`으로 계속 실행했다.
- 실패하면 `last_scheduled_run_date_kst`를 저장하지 않아 같은 날짜에 15분마다 재시도될 수 있었다.
- 2026-05-17은 수동/자동 배치를 많이 돌린 날이라, 늦은 시간의 `update_companies.py`가 OpenDART `corpCode.xml` 호출 한도 또는 일시적인 DART 응답 오류에 걸렸을 가능성이 높다.
- 기존 `update_companies.py`는 DART가 zip 대신 오류 XML/텍스트를 반환해도 명확한 메시지를 남기지 못했다.
- 기존 `run_scheduled.py`는 subprocess 실패 stderr/stdout을 DB에 저장하지 않고 generic `returned non-zero exit status 1`만 남겼다.

## 구현
- `batch/run_scheduled.py`
  - `schedule_window_minutes`를 실제 실행 허용 시간으로 해석하도록 변경했다.
  - 예: `08:00`, `60분`이면 08:00~09:00에만 자동 배치가 실행되고 이후는 `missed schedule window`로 skip.
  - scheduled run id를 `scheduled-YYYYMMDD-HHMMSS`로 변경해 같은 날짜 실패 이력이 덮어써지지 않게 했다.
  - subprocess stdout/stderr tail을 캡처해서 `batch_runs.error_sample`에 더 자세히 남기도록 했다.
  - 한 command가 실패해도 가능한 나머지 command는 계속 실행하고, 결과를 `success`/`partial`/`failed`로 기록한다.
  - 실패해도 그날 scheduled attempt로 기록해 같은 실패를 하루 종일 반복하지 않게 했다.
  - 관심종목 가격 배치 실패가 전체 scheduled batch를 막지 않게 했다.
- `batch/update_companies.py`
  - DART `corpCode.xml` 응답이 zip이 아닐 때 OpenDART status/message를 파싱해 명확한 오류를 내도록 했다.
- `app/admin/AdminDashboard.tsx`
  - `지연 경고 기준(분)` 문구를 `실행 허용 시간(분)`으로 변경했다.
  - 설명도 허용 시간 이후에는 그날 자동 배치를 건너뛰는 것으로 수정했다.

## 검증
- `python -m compileall batch\run_scheduled.py batch\update_companies.py`
- synthetic schedule check:
  - 07:59 -> before schedule
  - 08:30 -> due
  - 09:01 -> missed schedule window
- `python batch\update_companies.py --market ALL --dry-run`
- `npm run lint`
- `npm run build`

## 다음 에이전트 인수인계
- 과거 실패의 원문 stderr는 GitHub 로그 다운로드 권한이 없어 직접 확인하지 못했다.
- 하지만 DB 설정과 실패 시간, 이후 로컬 재현 결과상 스케줄러의 무제한 late retry와 DART 한도/일시 오류 조합이 가장 가능성이 높다.
- 다음 실패부터는 `batch_runs.error_sample`에 subprocess stdout/stderr tail이 남아 원인 분석이 쉬워진다.
