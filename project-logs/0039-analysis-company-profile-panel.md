# 0039 분석 화면 기업 개요/제품서비스 패널

## 요청
- 분석 대시보드의 삼각형 다이어그램 페이지에서 선택한 기업의 개요와 주요 제품/서비스를 명시하고 설명하는 영역을 추가하고 싶음.

## 판단
- 기존 `/api/watchlist/analysis`는 재무 지표만 내려주고 있어 회사 설명에 필요한 시장, 섹터, 업종 정보가 부족했다.
- DB에 기업별 상세 설명 컬럼이 아직 없으므로, 주요 기업은 curated profile을 제공하고 나머지는 섹터 기반 fallback 설명으로 빈칸 없이 보여주는 방식으로 구현했다.

## 구현
- `lib/company-profile.ts` 추가.
  - 한국/미국 주요 기업의 개요와 제품/서비스 목록을 curated profile로 정의했다.
  - 미등록 기업은 GICS 섹터 기반으로 사업 개요와 대표 제품/서비스를 생성한다.
- `/api/watchlist/analysis` 응답 확장.
  - `market`, `gics_sector`, `industry_name`, `profile`을 추가했다.
  - 회사 섹터 컬럼 존재 여부를 보장하기 위해 `ensureCompanySectorColumns()`를 호출한다.
- `app/analysis/page.tsx` 개선.
  - 삼각형 다이어그램 아래에 `기업 개요와 주요 제품/서비스` 패널을 추가했다.
  - 선택한 기업별로 개요, 섹터/시장, 제품·서비스 태그, 프로필 출처를 표시한다.

## 수정 파일
- `lib/company-profile.ts`
- `app/api/watchlist/analysis/route.ts`
- `app/analysis/page.tsx`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0039-analysis-company-profile-panel.md`

## 검증
- `npm run lint` 통과.
- `npm run build` 통과.

## 다음 에이전트 인수인계
- 현재 기업 설명은 DB 저장형이 아니라 코드의 curated profile + 섹터 fallback 구조다.
- 향후 관리자에서 기업별 개요를 직접 수정하게 하려면 `company_profiles` 또는 `companies.overview/products_services` 컬럼을 추가하고 `buildCompanyProfile()`에서 DB 값을 우선하도록 확장하면 된다.
- 분석 화면은 지표가 완비되어 삼각형이 렌더링되는 선택 종목에 대해 프로필 패널을 표시한다.

## 수행 시간
- 약 3분
