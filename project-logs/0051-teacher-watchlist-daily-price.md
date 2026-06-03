# 0051 - Teacher Watchlist Daily Price

## Request

- 사용자가 보낸 종목 묶음을 별도로 추가한다.
- 해당 종목들의 가격을 하루 한 번 주기적으로 가져오도록 새 배치를 만든다.
- 상단 대메뉴에 `담쌤관심종목`을 추가하고, 기존 관심종목처럼 그리드 형태로 조회한다.

## Implementation

- `teacher_watchlist` 테이블을 추가했다.
  - 사용자가 보낸 27개 항목을 고정 목록으로 seed한다.
  - 상장 종목 26개는 `companies`에도 기본 코드/시장/섹터 정보를 upsert한다.
  - `스페이스X`는 비상장 기업이라 목록에는 표시하되 가격 배치 대상에서는 제외한다.
- `GET /api/teacher-watchlist`를 추가했다.
  - 로그인 사용자만 호출할 수 있다.
  - `teacher_watchlist`, `companies`, 최신 `metrics_history`를 조인해 가격/전일가격/등락률/시가총액/재무지표를 반환한다.
- `/teacher-watchlist` 페이지를 추가했다.
  - 가로 스크롤 가능한 엑셀형 그리드로 표시한다.
  - 시가총액, ROE, PBR, PER, 가격, 등락률 기준 정렬 버튼을 제공한다.
  - 비상장 또는 가격 수집 제외 항목은 비고에 표시한다.
- 상단 메뉴에 `담쌤관심종목` 링크를 추가하고 `proxy.ts` 보호 라우트에 포함했다.
- `batch/update_watchlist_prices.py`에 `--scope teacher`를 추가했다.
  - 담쌤 목록의 상장 종목만 골라 최신 가격/전일가격/등락률을 갱신한다.
  - 신규 미국 종목처럼 주식수가 아직 없는 경우에도 가격 데이터는 저장되도록 완화했다.
- `batch/run_scheduled.py`에 담쌤 관심종목 일일 가격 스케줄을 추가했다.
  - 기본 실행 시각: 매일 06:45 KST
  - 실행 상태는 `batch_settings`의 `last_teacher_watchlist_price_*` 키에 저장한다.
- GitHub Actions workflow에 `teacher_watchlist_prices` 수동 실행 모드를 추가했다.

## Seeded Items

- 엔비디아, 삼성전자, SK하이닉스, TSMC, 브로드컴, 샌디스크(WDC), 삼성전기, 마벨테크놀로지, 알파벳, 마이크로소프트, 메타, 아마존, 팔란티어, 현대차, 현대모비스, 테슬라, 센트러스 에너지, 이튼, GE버노바, 한화에어로스페이스, LIG넥스원, 스페이스X, 삼양식품, 애플, 삼성생명, 삼성증권, SK텔레콤

## Modified Files

- `.github/workflows/stock-batch.yml`
- `app/api/teacher-watchlist/route.ts`
- `app/layout.tsx`
- `app/teacher-watchlist/page.tsx`
- `batch/migrate_db.py`
- `batch/run_scheduled.py`
- `batch/update_watchlist_prices.py`
- `lib/batch-settings.ts`
- `lib/teacher-watchlist.ts`
- `proxy.ts`
- `PROJECT_PRESENTATION_NOTES.md`

## Validation

- `python -m py_compile batch/migrate_db.py batch/run_scheduled.py batch/update_watchlist_prices.py` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `python batch/migrate_db.py` completed and seeded Turso.
- `python batch/update_watchlist_prices.py --scope teacher --market ALL --limit 5 --dry-run` passed: 5/5 succeeded.
- `python batch/update_watchlist_prices.py --scope teacher --market ALL --run-id teacher-watchlist-price-manual-20260603` completed: processed 26, succeeded 26, failed 0.
- Local route responded at `http://127.0.0.1:3000/teacher-watchlist`.

## Handoff Notes

- 스페이스X는 비상장이라 가격 배치에서 제외된다. 향후 별도 평가가 필요하면 비상장 기업 가격/가치 테이블을 따로 두는 편이 낫다.
- 담쌤 가격 배치 기본 시각은 06:45 KST이며, GitHub Actions schedule이 15분마다 `run_scheduled.py`를 호출하면서 DB 설정 기준으로 하루 1회 실행한다.
- 관리자 UI에는 아직 담쌤 배치 설정 컨트롤을 별도로 노출하지 않았다. 필요하면 `teacherWatchlistPriceEnabled`, `teacherWatchlistPriceTimeKst`를 배치설정 탭에 추가하면 된다.
