# 0032. GICS 섹터 매칭 및 관심종목 지표 툴팁

## 요청
- 수집된 종목에 글로벌 표준 GICS 11대 섹터를 매칭한다.
- 한국 주식 KRX 업종과 미국 주식 S&P/GICS 업종을 11대 섹터로 분류하는 예시 딕셔너리/맵을 포함한다.
- 관심종목 화면에서 섹터명 옆에 `[?]` 아이콘을 표시한다.
- 마우스 오버 시 섹터별 PER, PBR, ROE 특성을 요약한 툴팁을 보여준다.

## 수행 시간
- 시작: 2026-05-18 07:29:52 KST
- 완료: 2026-05-18 07:35:52 KST
- 소요: 약 6분

## 구현 계획
1. GICS 11대 섹터와 섹터별 지표 가이드를 코드 데이터로 정의한다.
2. 기업 마스터에 `gics_sector`, `industry_name`, `sector_source` 컬럼을 추가한다.
3. 배치에서 한국/미국 종목의 섹터를 추론해 저장한다.
4. 관심종목 API에서 DB 섹터값을 내려주고, 값이 비어 있으면 앱 로직으로 보정한다.
5. 관심종목 카드에 섹터명과 hover/focus 툴팁을 표시한다.

## 반영 내용
- `lib/gics-sector.ts`에 GICS 11대 섹터, 섹터별 PER/PBR/ROE 가이드, KRX 업종 매핑, 미국 업종 매핑, 주요 종목 override, 이름 키워드 fallback을 추가했다.
- `batch/sector_mapping.py`에 배치용 동일 매핑 딕셔너리와 `infer_gics_sector()` 로직을 추가했다.
- `batch/migrate_db.py`가 `companies` 테이블에 섹터 컬럼을 추가하고 기존 기업 중 매핑 가능한 종목을 backfill하도록 했다.
- `batch/update_companies.py`가 기업 마스터 갱신 시 `gics_sector`, `industry_name`, `sector_source`를 함께 upsert하도록 했다.
- `/api/watchlist`가 섹터 컬럼을 조회하고, DB에 값이 없으면 TypeScript 매핑 로직으로 fallback 섹터를 내려주도록 했다.
- 관심종목 카드 종목명 아래에 `섹터: ... [?]` UI를 추가하고, 순수 Tailwind hover/focus 툴팁으로 섹터별 지표 가이드를 표시했다.

## 수정 파일
- `lib/gics-sector.ts`
- `lib/company-sector-schema.ts`
- `batch/sector_mapping.py`
- `batch/migrate_db.py`
- `batch/update_companies.py`
- `app/api/watchlist/route.ts`
- `app/watchlist/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0032-gics-sector-tooltip.md`

## 검증
- `npm run lint` 통과
- `npm run build` 통과
- `python -m py_compile batch/sector_mapping.py batch/update_companies.py batch/migrate_db.py` 통과
- 샘플 매핑 확인:
  - `005930` -> `정보기술`
  - `AAPL` -> `정보기술`
  - `JPM` -> `금융`
  - `XOM` -> `에너지`

## 다음 에이전트 인수인계
- 현재 별도 종목 상세 페이지는 없어서 관심종목 카드에 섹터 툴팁을 적용했다.
- GICS 정확도를 더 높이려면 S&P/GICS 또는 외부 라이선스 데이터 소스를 별도로 확보해 `industry_name`과 `gics_sector`를 원천 데이터로 적재하는 방식이 좋다.
- 현재 로직은 주요 종목 override, 업종명 매핑, 회사명 키워드 fallback 순서로 동작한다.
