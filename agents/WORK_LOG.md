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

## 2026-09-08 — 1단계 착수, 원본 읽기 오류

- 사용자 승인 후 문서 커밋 `4a84a87`을 로컬 main에 fast-forward 병합하고 `feat/flyway-baseline`을 생성했다. 원격 push는 하지 않았다.
- 시작 주간 사용률은 3%, 이번 작업 중 재조회는 4%다. 최초 기준 2% 대비 +2%포인트. 한 조회에서 reset timestamp가 1초 달랐고 후속 조회에서 원래 값으로 돌아왔다. 사용률 초기화는 관찰하지 않았다.
- Docker 직접 시작 시 Model Runner 임시 소켓 오류를 확인했다. 공식 CLI로 Model Runner를 비활성화한 뒤 Docker 엔진 응답을 확인했다. 기존 컨테이너·볼륨·이미지는 없었다.
- 사용자가 postgres_data를 최신 DB 원본으로 확인했다. PostgreSQL 16 파일 클러스터로 최소 구조를 확인했으며 실제 테이블은 미조회다.
- Git 밖 백업 도구를 작성하고 원본 읽기·사본 해시 검증을 시도했다. 원본 `base/4/2704`에서 CRC가 발생해 **복사 시작 전에 실패**, 백업 디렉터리 미생성을 확인했다. 반복 재시도하지 않았다.
- 같은 시각 Windows disk Event ID 7 bad-block 오류와 D: → Disk 0 대응을 확인했다. 데이터 보존을 우선해 실제 DB 실행·Flyway 전환을 보류했다.
- 검증용 pgvector pg16 이미지만 내려받았다. 검증 컨테이너·DB 생성, 백업 복원, 초기 마이그레이션 SQL, Hibernate validate 전환, 실제 DB 변경은 수행하지 않았다.
- 다른 디스크 백업 또는 기존 AWS DB의 보존 여부를 사용자에게 질문했다. 상세 증거·재개 조건은 [DB 작업서](DATABASE_MIGRATION.md)에 기록했다.
- 애플리케이션 소스와 프로파일은 변경하지 않았다. 백업 도구의 합성 파일 검증은 실제 DB의 복구 성공과 구분해 기록한다.
- 합성 fixture 검증 통과: 이진 파일 보존, 해시 성공/복원 미검증 구분, 기존 대상 덮어쓰기 거부, 저장소 내부 출력 거부, 실행 중 클러스터 표식 거부. 테스트는 별도 C: 작업 경로에서 수행했고 실제 DB는 사용하지 않았다. 문서 로컬 링크·공백 검사도 통과했다.
- 이 브랜치는 중간 보존 지점이며 1단계 완료·병합 승인 요청 상태가 아니다. 실제 DB 백업과 복원 검증이 재개 조건이다.

## 2026-09-08 — 사용자 재개 요청 이후 Flyway 구현

- 사용자는 데이터가 거의 없으므로 Flyway 작업을 계속하도록 요청했다. 확인한 새 컨테이너 tender_feistel은 비밀번호 누락으로 초기화 전 종료됐고 마운트 볼륨은 비어 있었다. 현재 Docker 데이터 경로는 C:이며 에이전트가 변경한 설정은 아니다.
- 원래 D: 클러스터를 재읽거나 삭제하지 않고, 빈 DB용 V1과 합성 fixture baseline·복원 검증으로 진행했다. 기존 DB 복구 성공으로 간주하지 않는다.
- Flyway 모듈/SQL, Hibernate validate, Spring AI 자동 스키마 생성 끔, 별도 벡터 차원 검증, 기본 runner 비활성화, 관리/백업/복원 스크립트, 기존 볼륨을 재사용하는 DB Compose를 준비했다.
- JUnit 시나리오 7개를 전체/추가 실행으로 검증했다. 독립 Hibernate DDL과 V1 비교, 초기화 순서, 명시적 baseline 전후 전체 행/벡터/시퀀스, drift 차단, 합성 백업 복원 비교가 통과했다.
- Invoke-Flyway validate/migrate, package -DskipTests, JAR 비밀 파일 제외, Compose config --quiet를 통과했다. 최초 포트 연결 실패와 복원 CHECK 표현 비교 실패는 수정 후 관련 검증을 재실행했다.
- 테스트 컨테이너와 파일은 C:의 전용 경로이며 실제 서비스 DB·Gemini·메일은 호출하지 않았다. 검증 DB는 보존한다. 실제 적용 대상 볼륨·복구/실행안은 [Flyway 작업서](FLYWAY_RUNBOOK.md)에 있다.
- 최신 주간 사용률 7%, 최초 2% 대비 +5%포인트. 이번 기능 브랜치의 main 병합 및 서비스 DB 초기화는 아직 승인 대기다.
- 문서 12개의 로컬 링크와 PowerShell 스크립트 구문을 확인했다. 검증을 마친 icare-flyway-validation 컨테이너는 중지했고 DB와 백업은 보존했다. 실패한 사용자 컨테이너와 빈 볼륨은 변경하지 않았다.

## 2026-09-08 — 승인 후 실제 V1 적용 완료

- 사용자 승인에 따라 main을 7e31f2f까지 fast-forward 병합했다. 원격 push는 하지 않았다.
- 초기화 직전 빈 볼륨/정지 상태를 재확인하고 tender_feistel 컨테이너만 제거했다. 기존 볼륨을 재사용하는 parenting-postgres를 시작했다. 기존 D: 데이터 폴더와 볼륨 삭제는 없었다.
- DB 계정/임의 비밀번호는 C:의 사용자 접근 제한 파일에 보관했다. Git·문서에 비밀번호를 복사하지 않았다.
- 적용 전 실제 빈 DB 백업 886바이트를 격리 복원해 public 테이블 0개를 확인한 뒤, V1 migrate/validate를 수행했다.
- 실제 DB에서 Flyway V1 SQL 이력(checksum 691030920), public 테이블 16개, 업무/벡터 초기 행 0개, vector(3072), loopback 포트, healthy 상태를 확인했다.
- 적용 후 실제 DB 백업 33,298바이트도 별도 검증 DB로 복원하고 같은 스키마/빈 데이터/이력/차원 검사를 통과했다. 백업 경로·해시·복구 방법은 Flyway 작업서에 기록했다.
- 검증 컨테이너만 중지하고 실제 DB는 실행 중이다. 애플리케이션·관리자/지식 초기화·Gemini/SMTP·DNS/배포는 수행하지 않았다. 원래 손상 의심 파일의 복구는 이번 완료 범위가 아니다.

## 2026-09-08 — 2단계 비공개 백엔드 검수 준비

- 승인된 feat/private-backend를 main 9857b65에서 생성했다. 사용자 후속 요청에 따라 허용 이메일은 우선 1개만 Git 밖 보안 파일에 저장하고, 두 번째 주소 추가 위치를 주석으로 남겼다.
- 가입 MOM/DAD 제한, 사용자/관리자 토큰 구분, 요청마다 허용 목록·계정 존재·인증/활성 상태 검사, 서비스 헤더 인증, 가족별 일지/아기 접근 검사를 구현했다. 고정 관리자 생성과 인증번호 로그를 제거하고 명시적 관리자 bootstrap은 기본 비활성으로 두었다.
- AI 입력/검색 문맥/출력/호출 빈도 제한과 실패 시 무저장, 기본 프롬프트 의사 자칭 제거를 적용했다. 대화 이력 전달·저장된 프롬프트 수정·문서 형식/버전/출처 개선은 후속 범위다.
- Next 서버 경로에 Cloudflare/원본 서비스 인증 전달을 구현하고 브라우저 직접 backend URL 사용을 제거했다. 이미지 읽기 쿠키는 경로/메서드를 제한하고 로그아웃 시 제거한다.
- 소스부터 빌드하는 고정 Java 17 Docker 이미지, 기존 DB 네트워크에 백엔드만 연결하는 Compose, 외부 환경변수 예제와 실제 로컬 보안 설정을 준비했다. Gemini/SMTP/Cloudflare 실제 값은 미설정이다.
- 최종 JUnit 15개 통과, 기존 opt-in Flyway 테스트 6개는 이번 실행에서 건너뛰었다. 프록시 Node 테스트 5개, Next TypeScript/production build, 브라우저 번들 서버 인증 변수 미노출 검사를 통과했다. 기존 frontend lint 오류 7개/경고 11개는 남았다.
- 서비스 적용 후 빈 스키마 백업을 새 검증 DB icare_validation_private_20260908에 복원했다. 외부 인터넷이 없는 내부 네트워크에서 Docker 시작/JPA/Flyway validate, 합성 가입 검사 7개, 최종 HTTP 권한/날짜 경계 검사 19개를 통과했다. 실제 AI/메일 호출은 하지 않았다.
- 테스트 DB에는 합성 사용자 2명/아기 2명/일지 3개, 지식·관리자 0개만 있다. 검증 컨테이너 둘은 중지하고 DB와 파일을 보존했다. 실제 parenting-postgres는 기존 상태로 계속 healthy/loopback이며 2단계 서비스 DB 변경은 없다.
- 최신 주간 사용률 11%, 시작 2% 대비 +9%포인트. +20%포인트 중간 보고 기준 전이며 다른 계정 작업 사용량도 포함될 수 있다. 서브에이전트는 사용하지 않았다.
- 실행/복구·승인·미검증은 [2단계 작업서](PRIVATE_BACKEND_RUNBOOK.md)에 기록했다. feat/private-backend의 main 병합은 사용자 검수 대기이며 원격 push/DNS/Vercel 배포는 하지 않았다. 3·4단계는 브랜치 구성도 검수받은 뒤 진행한다.