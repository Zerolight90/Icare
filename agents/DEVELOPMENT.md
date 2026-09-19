# 실행·검증 안내

2026-09-19 환경설정 후속 변경: 로컬 실행은 [환경설정 작업서](ENVIRONMENT_RUNBOOK.md)의 루트 .env와 Start-IcareLocal.ps1을 사용한다. 실제 Gemini 합성 REST 답변/임베딩 연결은 확인했으며 SMTP/실사용 전체 흐름은 아직 미검증이다. 사용자 승인 후 129b106의 main 병합을 완료했다. 남은 작업은 [현재 상태](CURRENT_STATUS.md)를 따른다.

최신 검사/실행 제한은 [4단계 작업서](KNOWLEDGE_RUNBOOK.md)를 우선한다. 2026-09-19 JUnit 34개 통과/선택 테스트 1개 제외, Node 9개, Docker HTTP 48개, 최종 Docker/Next 빌드와 변경 파일 lint를 통과했다. 전체 frontend lint는 기존 오류 6개/경고 10개가 남았다. 실제 DB는 사용자 승인 후 V3 적용·검증을 완료했다. 실제 앱 실행 전 Gemini/SMTP 등 필수 설정을 확인하고 초기화·문서 적재는 기본 비활성을 유지한다. 아래 날짜별 수치는 당시 이력이다.

## 2026-09-08 비공개 백엔드 변경 이후

[2단계 실행·검증 안내](PRIVATE_BACKEND_RUNBOOK.md)를 최신 실행 기준으로 사용한다. Dockerfile은 소스 빌드 방식이고 `compose.backend.yml`은 기존 DB 네트워크에 백엔드만 연결한다. 브라우저는 Next 서버 `/api`를 사용한다. 실제 환경변수는 Git 밖 파일에 있으며 아직 Gemini/SMTP/Cloudflare 설정은 비어 있다. 서비스 DB와 외부 배포에는 2단계 변경을 적용하지 않았다.

백엔드 격리 테스트, Docker 시작/권한 HTTP 검사, 프록시 테스트, Next production build는 통과했다. 기존 프론트 lint 오류 7개/경고 11개는 남아 있다. 아래 오래된 루트 Compose/직접 API 연결 예제는 이번 실행 절차로 사용하지 않는다.

## 2026-09-08 Flyway 변경 이후

최신 실행과 실제 DB 적용 승인 절차는 [Flyway 작업서](FLYWAY_RUNBOOK.md)를 우선한다. dev/prod 모두 Hibernate validate와 Spring AI 스키마 자동 생성 비활성화를 사용한다. 빈 DB는 Flyway V1으로 구성하며 기존 DB는 검수한 명시적 baseline이 필요하다.

일반 `mvnw.cmd test`는 실제 DB/AI를 시작하지 않는다. 이전 contextLoads는 기본 초기화 runner가 비활성화되는지 확인하는 격리 테스트로 교체했다. PostgreSQL 통합 테스트는 ICARE_TEST_* 환경변수를 명시해야 실행한다. JAR 빌드와 합성 DB 검증을 수행했으며 실제 서비스·Gemini 연동은 미검증이다.

JAR에는 application-secret.yml/properties가 포함되지 않는다. JAR 실행 시 SPRING_DATASOURCE_URL/USERNAME/PASSWORD, JWT_SECRET, GEMINI_API_KEY 등 필요한 값을 외부 설정으로 공급해야 한다. 현재 `gemini.api.key` 참조는 환경변수 GEMINI_API_KEY로 공급할 수 있다. SMTP·Kakao 등 추가 설정은 기존 기능 사용 여부에 따라 별도로 준비한다.

아래 실행 예제와 결과는 2026-09-06 분석 당시의 이력이다. 특히 루트 Compose 전체 실행은 이번 DB 전환 절차로 사용하지 않는다.

## 실행 전제

백엔드는 Java 17과 Maven Wrapper, 프론트엔드는 Node/npm을 사용한다. 프론트엔드 Dockerfile의 런타임은 Node 20이다. 실제 모델·임베딩 API의 현재 지원 여부와 운영 자격증명은 이번 분석에서 확인하지 않았다.

백엔드 `application.yml`의 기본 프로파일은 dev이며 secret을 포함한다. `application-secret.yml.example`을 참고해 실제 비밀 설정을 준비해야 한다. 비밀 파일 내용은 이번 분석 문서에 수집하지 않았다.

| 설정 | 현재 의미 |
| --- | --- |
| `DB_HOST` | dev DB 호스트, 기본 localhost; Compose는 db 전달 |
| `PROD_DB_HOST`, `PROD_DB_PASSWORD` | prod DB 호스트·비밀번호; 설정상 username은 admin |
| `gemini.api.key` | dev/prod AI 설정이 참조하는 속성; secret 예제의 키 |
| `jwt.secret` | JWT 서명키; Compose는 JWT_SECRET 환경변수 전달 |
| `spring.datasource.username/password` | dev에서는 secret 예제로 공급 |
| `spring.mail.*` | SMTP 설정; prod 메일 구성은 배포 시 별도 준비 필요 |
| `kakao.rest-api-key` | 서버 병원 검색 API 키; secret 예제에는 별도 항목 없음 |
| `NEXT_PUBLIC_API_URL` | 브라우저 HTTP baseURL; 미지정 시 상대 /api 사용 |
| `BACKEND_URL` | Next.js rewrite 목적지; Docker 빌드 인자로 전달 |
| `upload.dir` | 이미지 저장 디렉터리, 기본 /app/uploads |

환경변수 이름만 선언되어 있다고 실제 배포에 값이 주입된다고 가정하면 안 된다. Compose의 DB 계정과 secret의 DB 설정이 일치해야 한다. 운영에서는 prod 프로파일 선택과 secret 공급 방식을 명시한다.

## 실행 명령

아래는 실행 방법이며 이번 문서 작업에서 서비스를 시작하지 않았다.

백엔드 개발 실행:

```powershell
Set-Location D:\work\babychatboot\babychatboot_backend\parenting
.\mvnw.cmd spring-boot:run
```

프론트엔드 개발 실행:

```powershell
Set-Location D:\work\babychatboot\babychatboot_frontend\chat-frontend
npm ci
npm run dev
```

현재 Dockerfile로 전체 빌드하려면 먼저 backend JAR가 있어야 한다. 설정된 DB·외부 서비스 또는 격리 테스트 환경을 준비한 뒤 다음 단계를 수행한다.

```powershell
Set-Location D:\work\babychatboot\babychatboot_backend\parenting
.\mvnw.cmd package
Set-Location D:\work\babychatboot
docker compose up --build -d
```

주의할 실제 전제: `contextLoads`는 전체 Spring 컨텍스트를 올리고 초기화 runner가 DB·VectorStore에 접근한다. 격리 설정 없이 package/test를 실행하면 외부 연결과 초기 데이터 변경을 시도할 수 있다. 이미지 업로드 디렉터리는 현재 Compose에 영속 볼륨이 없다.

## 이번에 수행한 검증

| 검사 | 결과 |
| --- | --- |
| 구조·보안·서비스·프론트엔드 흐름 | 소스와 설정 교차 확인 |
| API 지도 | 모든 Controller의 HTTP mapping 검색 |
| 프론트엔드 린트 | 30개 파일 검사, 오류 8개 / 경고 11개, 종료 코드 1 |
| 문서 링크·변경 범위 | 신규 문서의 로컬 링크와 Markdown 형식, Git 변경 범위 검사 |
| 프론트엔드 build/타입 검사 | 미실행 |
| 백엔드 테스트·통합 실행 | 미실행; DB·외부 서비스와 초기화 runner가 결합되어 있음 |
| 실제 권한 문제 재현·부하 측정 | 미실행; 정적 분석 근거와 검증 시나리오만 기록 |

린트 실행 명령은 프론트엔드 폴더에서 `npm.cmd run lint -- --format json --output-file ../../agents-lint-report.tmp.json`이었다. 임시 결과는 집계 후 제거했다. 따라서 아래 수치는 실제 실행 결과이며 테스트 통과를 의미하지 않는다.

### 린트 오류 위치

경로 기준: `babychatboot_frontend/chat-frontend`.

| 파일:줄 | 규칙 |
| --- | --- |
| app/admin/admins/page.tsx:54 | @typescript-eslint/no-explicit-any |
| app/admin/documents/page.tsx:85 | @typescript-eslint/no-explicit-any |
| app/admin/login/page.tsx:26 | @typescript-eslint/no-explicit-any |
| app/signup/page.tsx:108 | @typescript-eslint/no-explicit-any |
| app/admin/dailylogs/page.tsx:86 | react-hooks/set-state-in-effect |
| app/admin/posts/page.tsx:38 | react-hooks/set-state-in-effect |
| app/admin/users/page.tsx:37 | react-hooks/set-state-in-effect |
| app/admin/users/page.tsx:41 | react-hooks/set-state-in-effect |

경고는 effect 의존성 누락 9개와 미사용 변수 2개다. 의존성 경고는 관리자 게시글, 아기, 채팅, 커뮤니티 목록·상세·작성, 일지 2곳, 마이페이지에 있으며, 미사용 변수는 관리자 챗봇과 로그인 화면이다.

## 리팩토링 이후 검사 기준

프론트엔드:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

백엔드는 외부 시스템을 대역 처리한 테스트 구성을 만든 후 `mvnw.cmd test`를 실행한다. PostgreSQL/pgvector 통합 검사는 별도 테스트 DB에서 수행한다.

최소 회귀 시나리오는 관리자 역할 주입 차단, 가족 간 일지 접근 차단, 관리자 비활성화, 날짜 경계, AI 실패와 재시도, 방 전환 응답 역전이다. 단순 파일 분리만 확인하는 테스트보다 실제 사용자 동작·권한·데이터 보존을 검증한다.
