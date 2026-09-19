# 집 PC 배포 전환·복구 준비 (2026-09-19)

feat/blue-green-deploy는 feat/redis(9876cad) 위에서 계속 개발했다. 사용자 요청대로 작업을 이어가되 두 기능의 main 병합 검수는 별도로 유지한다. 현재 실행은 호스트 앱 + Docker PostgreSQL/Redis이고, 이 문서의 배포 명령은 **향후 실제 배포 승인 후** 실행한다.

## 구성

| 파일 | 역할 |
| --- | --- |
| docker-compose.yml | 로컬 의존성: 기존 PostgreSQL과 Redis만 실행 |
| compose.database.yml | 검수한 기존 DB 볼륨을 재사용하는 공통 정의 |
| compose.deploy.yml | blue/green별 프론트·백엔드. DB/Redis/볼륨 생성 없음, 외부 앱 포트 없음 |
| compose.gateway.yml | 두 버전을 전환하는 Nginx. 기본 127.0.0.1:18000 |
| scripts/deploy/Deploy-Icare.ps1 | 사전 검사 → 비활성 버전 빌드/시작 → 준비 확인 → 연결 전환 → 결과 확인/복구 |
| .github/workflows/ci.yml | 백엔드/Redis 테스트, 프론트 lint/Node/빌드, 프록시 전환·복구 검사 |
| .github/workflows/deploy.yml | main의 수동 배포/복구. 신규 배포는 CI 성공 후 집 PC runner에서 실행 |
| config/deployment-schema.json | 이미 승인·적용된 V1~V3 파일 해시와 실제 Flyway 체크섬 기준 |

구 compose.backend.yml은 제거했다. 로컬 앱은 Start-IcareLocal.ps1로 직접 실행한다. 프론트 Dockerfile은 npm ci/standalone/비관리자 실행/고정 Node 이미지로 정리했고 .env를 이미지에 복사하지 않는다. 백엔드는 기존 재현 가능한 소스 빌드와 비관리자 실행을 유지하고 readiness 검사로 바꿨다. 프론트에는 프록시 비밀값만 런타임에 공급하며 DB/JWT/Gemini/SMTP 비밀값은 공급하지 않는다. 지도 JavaScript 키는 공개 빌드 값이다.

## 전환과 실패 처리

- 현재 요청을 받는 버전은 유지하고 다른 버전을 먼저 빌드·시작한다. backend /readyz는 DB SELECT 1과 Redis PING을, frontend /healthz는 서버 실행을 확인한다. 일반 /healthz는 의존성 장애와 별도로 프로세스 생존을 나타낸다.
- 후보 준비 실패/타임아웃이면 기존 프록시 설정을 변경하지 않는다. 설정 검사 후 Nginx reload로 새 요청을 전환한다. 진행 중인 요청은 이전 worker가 처리하며 최대 130초 유예한다. Spring 종료 유예 130초, 컨테이너 종료 유예 140초를 적용한다.
- 전환 후 새 릴리스 표식, 프론트 health, 인증 없는 profile 요청의 401을 확인한다. 설정/상태 확인/상태 파일 저장 실패 시 이전 설정으로 reload한다. 복구 자체 실패는 성공으로 숨기지 않는다.
- 이전 앱은 즉시 중지하지 않아 진행 중인 요청·복구·직전 버전 정적 파일을 제공한다. Next deploymentId로 버전 불일치 시 새로고침을 유도하고 새 버전에서 없는 정적 파일은 직전 서버로 전달한다. 두 버전보다 오래 열린 화면은 새로고침이 필요할 수 있다.
- 다음 배포는 비활성 슬롯을 재사용한다. 후보 교체 도중 실패하면 현재 서비스는 유지되지만 오래된 복구 슬롯이 후보로 교체됐을 수 있다. rollback은 실제 컨테이너 이미지와 기록된 릴리스가 일치하는지 검사하고 불일치하면 중단한다.
- 동시 배포는 GitHub concurrency와 PC의 파일 잠금으로 차단한다. 강제 프로세스 종료 뒤 gateway/state 표식이 다르면 다음 배포를 차단하므로 상태를 확인하고 복구해야 한다. 검증 결과를 확인하지 않고 state.json을 임의 변경하지 않는다.
- 배포 전 SQL 파일 해시와 실제 DB Flyway 이력을 읽기 전용으로 비교한다. 새로운/변경된 SQL, 누락된 실제 적용 이력이 있으면 배포를 중단한다. DB 적용/manifest 변경은 SQL 검토·백업·별도 승인 과정이며 이 파이프라인이 자동 수행하지 않는다.
- JWT/프록시/Redis 비밀번호와 업로드 디렉터리는 두 버전이 공유한다. 배포 중 비밀값 교체·비호환 API/DB 변경은 별도의 호환성 계획이 필요하다.

이 구성은 앱 버전 전환 중 중단을 줄이는 준비다. PC/Docker/전원/DB/Redis 장애까지 버티는 다중 서버 고가용성은 아니며, 실제 프론트·백엔드 컨테이너를 이용한 전체 무중단 배포 성공을 아직 주장하지 않는다.

## 로컬 검증 결과

- 백엔드 46개 중 35개 통과, 선택 DB 검사 11개 제외. Redis 실제 연결/동시성/캐시, readiness의 의존성 실패 처리 포함. JAR 빌드 통과. 빌드 중 이전 검증 JAR가 열려 있어 한 번 파일 잠금 오류가 났고 해당 테스트 프로세스 종료 후 패키징 성공.
- Redis 단계의 호스트 백엔드 API 검사 48개 통과. 최종 호스트 JAR의 readiness 200, 격리 DB 중지 시 readiness 503/liveness 200 확인. 실제 DB는 변경 없이 V1~V3 이력만 조회했다.
- 프론트 Node 검사 10개, production standalone 빌드, 최종 타입 검사 통과. 전체 lint 오류 0/기존 경고 9. 기존 오류 6개를 필요한 범위에서 수정했고 가입 비밀번호 표시를 서버의 12자와 맞췄다. 가입 성공 후 메일 실패 시 재가입 대신 인증 단계에서 재발송할 수 있도록 수정했다. 실제 메일 발송은 미검증.
- 실제 Nginx + 합성 호스트 서버 두 개로 전환, 진행 중 요청 유지, 직전 정적 파일 제공, 잘못된 설정 복구, health 실패 복구, 명시적 이전 버전 복구를 통과했다. Windows host.docker.internal/임시 포트 차이를 테스트 스크립트에 반영했다. 앱 컨테이너는 실행하지 않았다.
- Compose 해석, 앱 포트 비공개, 프론트 환경변수 전달 목록, 실제 적용 DB와 manifest 일치, PowerShell/YAML 문법, HTTPS/상태 디렉터리 사전 검사 통과.
- GitHub 실제 CI 실행/runner 등록/환경 승인 설정, 신규 Docker 앱 이미지 빌드와 전체 컨테이너 배포, 실제 도메인/TLS/외부 연결·브라우저 실사용 흐름은 미검증이다. 원격 push/DNS/배포도 미실행이다.

## 향후 배포 준비 순서

1. 코드 검수·main 병합 후 사용자가 원격 반영을 요청한다. 저장소의 Actions에서 CI 결과를 확인한다.
2. 집 PC에 PowerShell 7, Docker Desktop, Git, Java 17, Node 22를 준비한다. 신뢰하는 비공개 저장소 전용 self-hosted Windows X64 runner에 icare-deploy 라벨을 붙인다. PR 코드는 이 runner에서 실행하지 않는다.
3. GitHub environment home-pc의 required reviewers를 설정한다. 환경 변수 ICARE_DEPLOY_ENV_FILE에는 C:/Users/USER/.icare/deployment.env 같은 **파일 경로만** 입력한다. 실제 비밀값은 PC의 해당 .env에 둔다.
4. 루트 .env의 필요한 값을 외부 deployment.env로 복사하고 ICARE_DEPLOY_STATE_DIR=C:/Users/USER/.icare/deployment, ICARE_GATEWAY_PORT=18000, ICARE_FRONTEND_ORIGIN=https://실제도메인을 지정한다. 기존 DB 네트워크·자격증명·공유 업로드 디렉터리를 그대로 사용한다. SMTP_USERNAME 등 비어 있는 값과 기존 SMTP/Kakao 키의 유효성을 확인한다.
5. 도메인/TLS 연결은 별도 검수한다. 가비아 등록과 기존 DNS/메일/Vercel 기록을 보존한다. Cloudflare Tunnel로 게이트웨이의 localhost:18000을 연결하거나, 별도 검수한 HTTPS reverse proxy/라우터 경로를 사용한다. 현재 루프백 포트만 열려 있으므로 외부 PC IP로 직접 접근할 수 없다. DB/Redis/앱 내부 포트를 인터넷에 개방하지 않는다.
6. 최초 Docker 앱 배포는 승인된 실제 설정으로 수행하고 브라우저 가입/인증/채팅/일지/게시판을 확인한다. 이후 실제 요청을 유지한 전환·복구 리허설을 완료해야 실제 서비스 무중단 검증 완료로 기록한다.

사전 검사(실행·변경 없음):

```powershell
./scripts/deploy/Deploy-Icare.ps1 -EnvFile C:/Users/USER/.icare/deployment.env -Release <검수한Git커밋> -CheckOnly
```

실제 배포 승인 후 GitHub 수동 workflow에서 deploy 또는 rollback을 선택한다. 수동 명령도 동일 스크립트의 -Action deploy/rollback을 사용한다. 현재 저장소 checkout과 릴리스가 일치하고 추적 파일에 미커밋 변경이 없어야 빌드한다. rollback은 신규 CI 빌드 성공을 기다리지 않고 이미 남아 있는 직전 이미지를 확인해 전환한다. 첫 배포 실패로 상태 파일이 없는 설정이 남으면 게이트웨이/후보 상태를 점검한 뒤 초기화 여부를 결정한다.

로컬 검증 재실행: ./scripts/deploy/Test-Gateway.ps1 (임시 프록시만 실행하고 자동 제거). 실제 앱 컨테이너는 사용하지 않는다.

공식 동작 근거: [Nginx reload](https://nginx.org/en/docs/control.html), [Spring graceful shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html). Next 설정은 설치된 16.2.1의 output/deploymentId/self-hosting 문서를 확인했다.

최종 실제 로컬 기동: 루트 .env로 호스트 백엔드(8080)·프론트(3000, webpack)를 시작했고 /readyz 200, 가입 화면 200, 프론트 경유 인증 없는 profile 401을 확인했다. 실제 사용자 가입·메일·AI 호출 없이 기동/연결만 검사했다. 로그와 프로세스 기록은 C:/Users/USER/.icare/local-run에 보관한다. 숨겨 실행한 로컬 앱은 scripts/Stop-IcareLocal.ps1로 중지할 수 있다. 이는 로컬 개발 프로세스 종료용이며 운영 배포의 graceful 종료에는 사용하지 않는다.
