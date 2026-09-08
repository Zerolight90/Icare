# 작업 기록

## 2026-09-08 — 0단계

### 시작 상태

- 시작 브랜치 `codex/dev`, 커밋 `b14f83a`. 로컬 `main`과 ahead/behind 0/0. 원격 최신 상태는 조회하지 않았다.
- 기존 미커밋 파일은 루트 `AGENTS.md`와 `agents/` 문서다. 삭제하거나 초기화하지 않고 보존했다.
- 주간 사용률 시작값 2%. 예산 기준은 [실행 합의](EXECUTION_PLAN.md)에 기록했다.
- 사용자에게 `feat/architecture-docs` → `feat/flyway-baseline` → `feat/private-backend` 구성 승인을 받았다. 첫 브랜치를 생성했다. 병합 승인은 별도다.

### 현재 소스에서 재확인한 내용

| 항목 | 확인 내용 | 근거 |
| --- | --- | --- |
| 기술 | Next.js, Spring Boot 3.5.13, Spring AI 1.1.5, Gemini | 프론트 설정, 백엔드 pom.xml 및 프로파일 |
| DB 스키마 | Flyway 의존성·마이그레이션 없음, dev update / prod validate | pom.xml, application-dev/prod.yml |
| 벡터 | dev 3072/NONE, prod 768/HNSW, 양쪽 자동 스키마 생성 true | application-dev/prod.yml |
| 채팅 모델 | 두 프로파일 gemini-2.5-flash-lite | application-dev/prod.yml; 실제 API 사용 가능 여부 미검증 |
| DB 실행 선언 | pgvector pg16 이미지, postgres_data bind mount, 호스트 5432 게시 | 루트 docker-compose.yml; 실제 컨테이너 상태와 구분 |
| JPA | 14개 엔티티. ChatRoom은 명시적 Table annotation 없음. Record 별도 존재 | domain/*.java; 실제 스키마 미조회 |
| 시작 부작용 | 기본 관리자·게시판·설정 자동 저장, 벡터 검색·문서 적재 | DataInitializer, KnowledgeLoaderService |
| 권한 | 가입 role을 저장·JWT로 발급, 필터는 ROLE_ 접두사 사용. 일지 서비스에 가족 비교 없음 | UserService, JwtAuthenticationFilter, DailyLogService |
| 대화 | 질문·답변 저장, 모델 입력에는 현재 질문·시스템 프롬프트·RAG만 전달 | GeminiService.askToGemini |
| AI 안내 | 일반 채팅 기본값과 건강 문진, 초기 DB 설정 프롬프트에 의사 자칭 | GeminiService, DataInitializer; 실제 DB 설정은 미조회 |
| 프론트 전달 | rewrite 및 선택적 브라우저 baseURL, 서비스 인증 주입 없음 | next.config.ts, app/lib/axios.ts |
| 테스트 | contextLoads가 전체 앱을 시작하는 형태 | ParentingApplicationTests; 실행하지 않음 |

### 변경 내용

기존 아키텍처·백엔드·프론트엔드·실행 안내를 읽고 위 핵심 경로를 소스와 대조했다. 루트 지침과 문서 인덱스에 실행 합의를 연결하고 백엔드 AGENTS.md를 추가했다. 기존 리팩토링 권장 순서와 이번 사용자 지정 순서를 구분했다. 애플리케이션 소스·설정·DB는 변경하지 않았다.

### 환경 확인과 제한

Docker 목록 조회는 최초 접근 권한 문제 후 권한을 허용받아 재시도했다. 이후에도 Docker Desktop Linux 엔진 파이프가 없어 연결되지 않았다. Docker Desktop 프로세스는 조회되지 않았고 관련 서비스는 Stopped였다. 로컬 postgres_data 경로는 존재하지만 데이터 내용은 읽지 않았다. Java 17 실행 파일, Docker CLI, Node, Maven Wrapper 파일 존재를 확인했다.

Docker Desktop 시작을 권한 허용 후 요청했으나 완료 응답이 없었다. 후속 상태 조회도 응답이 없어 두 CLI 대기를 중단했다. Docker 엔진 시작 성공이나 컨테이너 상태는 확인되지 않았다. Docker Desktop의 시작 상태를 사용자와 확인한 뒤 실제 DB 목록 조회를 재개해야 한다. 루트 Compose 전체 실행이나 DB 생성은 수행하지 않았다.

### 미수행과 다음 단계

0단계 문서 검사: 루트/백엔드 지침 및 agents 문서 총 10개의 로컬 Markdown 링크가 모두 유효했다. 스테이징된 문서의 공백 검사도 통과했다. 애플리케이션 추적 파일 변경은 없었다. 주간 사용률 재조회는 3%로 시작 대비 +1%포인트이며 같은 reset 창이다. 기존 미커밋 분석 문서도 보존하여 최초 문서 커밋 범위에 포함했다.

- 실제 DB 컨테이너·마운트·네트워크 확인, 백업, 격리 복원, 스키마 비교와 Flyway SQL 작성은 아직 미완료다.
- 0단계 문서의 링크·변경 범위를 검사한 뒤 `main` 병합을 검수받는다. 승인 전 병합하지 않는다.
- DB·AI에 접근할 수 있는 앱 실행과 contextLoads는 실행하지 않았다. 빌드·테스트 통과 상태를 주장하지 않는다.
- 기능 브랜치 병합 승인 후 1단계로 진행한다. DB 연결이 불가능하면 임의 스키마나 벡터 차원을 확정하지 않는다.
- 문서만 변경했으므로 런타임 실행·DB 복구 작업은 필요하지 않다. 되돌릴 때는 이번 추가 지침·문서만 대상으로 하고 기존 미커밋 문서를 삭제하지 않는다.
