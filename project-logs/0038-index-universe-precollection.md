# 0038 S&P500/KOSPI200 지수 구성종목 사전수집

## 요청
- S&P500 기업과 KOSPI200 기업, 총 약 700개 기업의 정보를 미리 수집해두고 싶음.

## 판단
- Vercel 함수에서 직접 700개를 수집하면 시간과 호출량 문제가 생기므로 GitHub Actions 배치로 실행하는 구조가 맞다.
- 기존 `update_metrics.py`가 코드 목록 기반 수집을 이미 지원하므로, 지수 구성종목을 먼저 가져와 DB에 저장한 뒤 해당 코드만 넘기는 방식으로 재사용했다.
- 현재 기준 구성종목은 S&P500 503개, KOSPI200 200개로 총 703개가 잡힌다. S&P500은 복수 share class가 있어 500개보다 많게 표시될 수 있다.

## 구현
- `batch/update_index_universe.py` 추가.
  - Wikipedia의 S&P500 구성종목 표를 읽어 US 회사 마스터와 `index_memberships`에 저장한다.
  - Wikipedia의 KOSPI200 구성종목 표를 읽고, DART corpCode와 매칭해 KR 회사 마스터와 `index_memberships`에 저장한다.
  - `--collect-metrics` 옵션으로 구성종목의 재무/가격 수집까지 이어서 실행한다.
  - 기본 수집 대상은 `--selection missing`으로 미적재 기업 위주다.
- `index_memberships` 테이블을 마이그레이션에 추가했다.
- GitHub Actions `stock-batch.yml`에 `index_universe` 수동 실행 모드를 추가했다.
- 관리자 API `/api/admin/trigger-index-universe` 추가.
  - GitHub Actions에 `index_universe` 모드를 dispatch한다.
  - 기본은 S&P500/KOSPI200 전체, US shard 1개로 실행해 약 703개 전체를 대상으로 한다.
- 관리자 `수동배치` 탭에 `S&P500+KOSPI200 사전수집` 버튼을 추가했다.

## 수정 파일
- `.github/workflows/stock-batch.yml`
- `batch/update_index_universe.py`
- `batch/migrate_db.py`
- `app/api/admin/trigger-index-universe/route.ts`
- `app/admin/AdminDashboard.tsx`
- `lib/github-actions.ts`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0038-index-universe-precollection.md`

## 검증
- `python batch/update_index_universe.py --index ALL --dry-run --limit 2`
  - S&P500 503개, KOSPI200 200개, 총 703개 확인.
- `npm run lint` 통과.
- `npm run build` 통과.

## 참고 소스
- S&P500 구성종목: `https://en.wikipedia.org/wiki/List_of_S%26P_500_companies`
- KOSPI200 구성종목: `https://en.wikipedia.org/wiki/KOSPI_200`
- KOSPI200 재무수집용 corpCode: OpenDART `corpCode.xml`

## 다음 에이전트 인수인계
- 관리자 페이지의 `수동배치` 탭에서 `S&P500+KOSPI200 사전수집` 버튼을 누르면 GitHub Actions가 실행된다.
- 실제 재무/가격 수집은 `update_index_universe.py --collect-metrics`가 `update_metrics.py --codes ...`를 호출해 처리한다.
- 첫 실행은 약 703개 전체를 대상으로 하므로 오래 걸릴 수 있다. 이후에는 `selection=missing` 기준으로 미적재 기업 위주로 동작한다.
- S&P500은 share class 때문에 500개보다 많은 503개가 정상적으로 잡힐 수 있다.

## 수행 시간
- 약 6분
