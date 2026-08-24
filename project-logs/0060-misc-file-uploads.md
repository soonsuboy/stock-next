# 0060 기타 메뉴 첨부파일 업로드/다운로드

## 요청사항
- 상단 `종목 토론` 옆에 `기타` 메뉴를 추가한다.
- `기타` 메뉴에서 첨부파일을 업로드하고 내려받을 수 있게 한다.
- 50MB 업로드가 가능한지 확인하고 가능하면 구현한다.

## 확인 내용
- Vercel Function 요청/응답 본문은 4.5MB 제한이 있어 서버 함수로 파일 본문을 직접 받는 방식은 50MB 업로드에 부적합하다.
- Vercel Blob client upload는 브라우저에서 Blob으로 직접 업로드되므로 50MB 파일을 처리할 수 있다. SDK/공식 문서 기준 최대 파일 크기는 5TB다.
- 이 구현은 파일 본문을 Vercel Function과 Turso DB로 보내지 않고, Turso에는 파일 메타데이터만 저장한다.

## 구현 내용
- `@vercel/blob` 의존성을 추가했다.
- 로그인 사용자 전용 `/misc` 페이지를 추가했다.
- 상단 메뉴에 `기타`를 추가하고 `/misc`를 Auth.js 보호 라우트와 `proxy.ts` matcher에 등록했다.
- `misc_files` 테이블 스키마를 추가했다.
  - `id`, `user_id`, `original_name`, `pathname`, `blob_url`, `download_url`, `content_type`, `size_bytes`, `status`, `created_at`, `uploaded_at`, `updated_at`
- 업로드 준비 API를 추가했다.
  - `/api/misc/files/upload-token`
  - 로그인 사용자만 호출 가능
  - 50MB 초과 시 413 반환
  - Vercel Blob client token 발급
  - `pending` 메타데이터 생성
- 업로드 완료/목록/삭제 API를 추가했다.
  - `/api/misc/files`
  - GET: 로그인 사용자 파일 목록 조회
  - POST: Blob `head()`로 실제 업로드 파일 검증 후 `ready` 처리
  - DELETE: Blob 파일과 DB 메타데이터 삭제
- `/misc` UI를 추가했다.
  - 파일 선택, 업로드 진행률, 50MB 제한 표시
  - 데스크톱 테이블과 모바일 리스트
  - 다운로드 URL로 직접 내려받기
  - 삭제 버튼
  - `BLOB_READ_WRITE_TOKEN`이 없으면 업로드 비활성 안내 표시
- `.env.example`에 `BLOB_READ_WRITE_TOKEN`을 추가했다.

## 수정 파일
- `package.json`
- `package-lock.json`
- `.env.example`
- `app/layout.tsx`
- `auth.ts`
- `proxy.ts`
- `lib/misc-files.ts`
- `app/misc/page.tsx`
- `app/misc/MiscFilesClient.tsx`
- `app/api/misc/files/route.ts`
- `app/api/misc/files/upload-token/route.ts`
- `batch/migrate_db.py`
- `PROJECT_PRESENTATION_NOTES.md`
- `project-logs/0060-misc-file-uploads.md`

## 검증
- `npm run lint` 성공
- `npx tsc --noEmit` 성공
- `npm run build` 성공
- 빌드 결과에서 `/misc`, `/api/misc/files`, `/api/misc/files/upload-token` 라우트 생성 확인

## 운영 메모
- 로컬 `.env.local`에는 아직 `BLOB_READ_WRITE_TOKEN`이 없어서 실제 업로드는 비활성 상태다.
- Vercel에서 사용하려면 프로젝트에 Vercel Blob Store를 연결하고 `BLOB_READ_WRITE_TOKEN` 환경변수를 Production/Preview/Development에 등록해야 한다.
- 현재 다운로드 URL은 Vercel Blob public URL이다. 앱 목록은 사용자별로 분리되지만 URL을 외부에 공유하면 URL을 아는 사람이 파일에 접근할 수 있다. 완전한 비공개 다운로드가 필요하면 private Blob과 서명 URL 또는 인증 프록시를 별도 설계해야 한다.

## 다음 에이전트 인수인계
- 사용자 요청이 “공유 자료실”에 가깝다면 `misc_files`에 `visibility` 컬럼을 추가하고, 목록 조건을 사용자별에서 전체/그룹별로 확장한다.
- 파일 업로드 실사용 전 `BLOB_READ_WRITE_TOKEN` 설정 후 `/misc`에서 1MB, 10MB, 50MB 샘플 업로드를 확인한다.
- 대용량 다운로드 권한 제어가 필요해지면 public Blob URL 대신 private Blob + 짧은 만료 URL 전략으로 전환한다.

## 수행시간
- 약 30분
