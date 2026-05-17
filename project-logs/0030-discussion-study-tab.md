# 0030. 종목토론 스터디 탭 및 AI 정리

## 요청
- 종목토론 메뉴에 탭을 구성한다.
- 기존 텔레그램 종목토론은 `텔레그램` 탭으로 유지한다.
- `스터디` 탭을 추가하고 `https://shinyduck21-svg.github.io/Stock-Study/#` 사이트의 전체 피드를 보여준다.
- 스터디 탭에 `[정리하기]` 버튼을 만들어 AI로 피드 내용을 요약정리, 핵심정리해서 옆에 보여준다.
- 앞으로 요청마다 `PROJECT_PRESENTATION_NOTES.md`에 요청사항, 반영내용 요약, 수행시간을 누적한다.

## 수행 시간
- 시작: 2026-05-18 07:11:30 KST
- 완료: 2026-05-18 07:20 KST
- 소요: 약 10분

## 구현 계획
1. Next.js 16의 Server/Client Component, Route Handler, fetch 문서를 확인한다.
2. 외부 스터디 사이트 구조를 확인해 피드 데이터 위치를 찾는다.
3. 종목토론 클라이언트 화면에 `텔레그램`/`스터디` 탭을 추가한다.
4. 스터디 탭은 iframe으로 외부 사이트를 보여주고, 오른쪽 패널에 AI 정리 결과를 표시한다.
5. OpenAI 호출은 클라이언트가 아니라 보호된 API 라우트에서 수행한다.
6. 린트/빌드 검증 후 발표 메모와 작업 로그를 남긴다.

## 반영 내용
- 외부 사이트가 Vite 정적 사이트이며 `data/posts.json`과 `docs/*.md`에 피드/본문이 있음을 확인했다.
- `/discussions` 화면에 탭 UI를 추가했다.
- `텔레그램` 탭은 기존 채팅방, 날짜, 요약, 메시지, 재무 집계 트리거 기능을 그대로 유지했다.
- `스터디` 탭은 외부 주식강의 사이트를 iframe으로 표시한다.
- `[정리하기]` 버튼을 누르면 `/api/discussions/study-summary`가 전체 피드 목록과 최근 본문 일부를 수집해 OpenAI Responses API로 요약한다.
- 정리 결과는 종합 요약, 핵심 정리, 반복 학습 주제, 확인할 항목으로 분리해 오른쪽 패널에 표시한다.
- 스터디 요약 API도 `requireDiscussionAccessApi()`를 사용해 종목토론 접근 권한이 있는 로그인 사용자만 호출할 수 있게 했다.

## 수정 파일
- `app/discussions/DiscussionsClient.tsx`
  - 탭 상태와 탭 버튼 추가
  - 스터디 iframe 영역 추가
  - AI 정리 버튼, 로딩/에러/결과 패널 추가
- `app/api/discussions/study-summary/route.ts`
  - 스터디 피드 수집 및 OpenAI 요약 API 추가
  - 종목토론 접근 권한 체크 적용
- `PROJECT_PRESENTATION_NOTES.md`
  - 37번 요청 기록 추가
- `project-logs/0030-discussion-study-tab.md`
  - 이번 작업 로그 추가

## 검증
- `npm run lint` 통과
- `npm run build` 통과
- 외부 스터디 사이트의 `data/posts.json`, `docs/briefing_*.md` fetch 확인
- 비로그인 상태에서 `/discussions`는 `/login`으로 307 redirect 확인
- 비로그인 상태에서 `/api/discussions/study-summary`는 401 반환 확인
- Browser plugin은 현재 세션에 Node REPL 도구가 노출되지 않아 직접 화면 캡처 검증은 하지 못했다. 대신 Next.js 프로덕션 빌드와 정적 피드 접근을 검증했다.

## 다음 에이전트 인수인계
- 스터디 요약은 전체 피드 목록 전체와 최근 본문 24개를 기반으로 한다. 모든 본문 200개 이상을 매번 읽으면 함수 시간이 길어질 수 있어 최신 본문 중심으로 제한했다.
- AI 요약 버튼은 `OPENAI_API_KEY`가 없거나 결제가 막힌 상태면 API 에러를 그대로 화면에 표시한다.
- iframe 사이트가 GitHub Pages의 X-Frame-Options 정책을 바꾸면 임베딩이 막힐 수 있다. 이 경우 새 창 링크는 계속 동작한다.
