# 0061 Vercel Blob 환경변수 연결

## 요청사항
- 인앱브라우저에 Vercel을 열어둔 상태에서 첨부파일 기능에 필요한 환경변수를 직접 설정한다.

## 수행 내용
- Vercel Storage에서 `stock-next-files` Blob Store가 생성된 것을 확인했다.
- Blob Store 설정을 확인했다.
  - Store: `stock-next-files`
  - Access: Public
  - Region: `ICN1` Seoul, South Korea
- `Connect to Project`에서 `stock-next` 프로젝트를 선택했다.
- `Add a read-write token env var to this connection` 옵션을 켰다.
- `stock-next` 프로젝트에 다음 환경변수가 추가된 것을 확인했다.
  - `BLOB_READ_WRITE_TOKEN`
  - `BLOB_STORE_ID`
  - `BLOB_WEBHOOK_PUBLIC_KEY`
- 환경변수 스코프는 Vercel 화면 기준 `Production and Preview`로 연결됐다.
- 기존 최신 배포는 환경변수 연결 전에 생성된 배포였으므로, 같은 커밋 `547c62a`를 Production으로 재배포했다.
- 재배포 결과 `Ready` 상태와 `stock-next-phi.vercel.app` Current 도메인 연결을 확인했다.

## 확인 결과
- Vercel Blob Store와 `stock-next` 프로젝트 연결 성공.
- 배포 사이트에서 `/misc` 첨부파일 업로드 API가 `BLOB_READ_WRITE_TOKEN`을 사용할 수 있는 상태가 됐다.

## 주의사항
- 로컬 `.env.local`에는 아직 `BLOB_READ_WRITE_TOKEN`이 자동으로 추가되지 않았다.
- 로컬에서 업로드 테스트를 하려면 Vercel 환경변수를 별도로 pull/복사하거나, Development 스코프에도 Blob 환경변수를 연결해야 한다.
- 현재 구현은 Public Blob URL을 사용하므로 파일 URL을 아는 사람은 다운로드할 수 있다.

## 수정 파일
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0061-vercel-blob-env-setup.md`

## 수행시간
- 약 15분
