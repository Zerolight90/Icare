# 2단계: 비공개 백엔드 검수·실행 안내

최신(2026-09-19): 2~4단계 main 병합과 실제 V3 적용, 적용 전후 백업 복원 검증을 완료했다. [4단계 작업서](KNOWLEDGE_RUNBOOK.md)의 실행 제한/검증 결과를 우선한다. Next 서버의 `ICARE_FRONTEND_ORIGIN`에는 실제 브라우저 origin을 설정하며 예제는 config/vercel-server.env.example에 있다. 실제 Cloudflare/Vercel 연결·배포는 미수행이다.

2026-09-08, `feat/private-backend`. 코드와 격리 검증 결과이며 실제 Cloudflare/Vercel 연결 완료 보고가 아니다. 1단계 DB 적용 결과는 [Flyway 작업서](FLYWAY_RUNBOOK.md)에 있다.

## 완료한 변경

| 영역 | 적용 내용 |
| --- | --- |
| 가입·로그인 | 외부 설정의 이메일 1~2개만 허용. 사용자 요청에 따라 지금은 1개만 설정했고 두 번째 주소 추가 주석을 남김. 빈 목록은 전체 차단 |
| 일반 사용자 권한 | 가입 역할은 MOM/DAD만 허용. JWT의 부모 역할을 관리자 권한으로 사용하지 않음 |
| 기존 토큰 | 사용자/관리자 계정 종류를 분리하고 요청마다 허용 이메일·실제 계정·이메일 인증/관리자 활성 상태 확인. 이전 형식 토큰은 재로그인 필요 |
| 가족 데이터 | 일지 조회·기간 조회·CSV·건강 문진·생성·수정·삭제, 아기 수정·삭제에서 가족 확인. 다른 가족 요청은 조회/출력/변경/AI 전에 거부 |
| 관리자 초기 설정 | 고정 관리자 생성 코드 제거. 별도 명시적 초기 설정만 가능하며 기존 관리자 행이 있으면 중단. 기존 계정/지식은 삭제하지 않음 |
| 비밀값 | 실제 secret 파일을 Docker 컨텍스트/JAR에서 제외. JWT·서버 인증키는 임의 생성하여 Git 밖에 저장. 계정 비밀번호/인증번호 직렬화·인증번호 로그 제거 |
| 서버 전달 | Next.js `/api/[...path]`에서 고정 BACKEND_URL로만 전달. 브라우저가 보낸 서비스/forwarded/cookie 헤더를 그대로 전달하지 않음 |
| 원본 백엔드 | 사용자 JWT와 별도로 `X-Icare-Proxy-Secret` 확인. 비밀값 미설정 시 API 차단. 최소 상태값만 주는 GET `/healthz` 제외 |
| 실행 | Java 17 이미지 digest·Maven Wrapper를 고정한 다단계 Docker 빌드. UID 10001, 읽기 전용 루트, 임시 디렉터리, loopback 포트, 기존 DB 네트워크만 사용 |

일반 API는 허용 사용자 JWT, 관리자 API는 별도 관리자 JWT가 필요하다. 관리자 로그인 아이디도 허용 이메일이어야 한다. 이전 `admin` 같은 이름의 행은 보존되지만 이 비공개 설정에서는 로그인할 수 없다. 비밀번호 변경 시 이미 발급한 JWT를 즉시 폐기하는 기능은 추가하지 않았으며 만료는 2시간이다. 삭제된 사용자/비활성 관리자/허용 목록에서 제거된 주소는 다음 요청부터 차단한다.

업로드 이미지는 비공개 커뮤니티 이용자 간 공유 범위다. 이미지 요청은 브라우저에서 Authorization 헤더를 달 수 없으므로 로그인 성공 시 `HttpOnly; SameSite=Strict; Path=/api/upload` 쿠키를 발급하고 GET 이미지 읽기에만 Bearer로 변환한다. 쓰기·프로필·일지 인증에는 이 쿠키를 사용하지 않는다. HTTPS 운영에서 Secure를 적용하고 로그아웃 시 제거한다. 기존 localStorage 토큰 방식은 유지했다.

## AI 제한과 범위

- 사용자 입력/조립된 건강 문진 입력: 기본 4,000자. 초과 시 AI 호출 전에 400.
- 일반 대화의 시스템 지시 최대 4,000자, 검색 문서 합계 최대 4,000자, 검색 결과 최대 5개. 메시지 객체로 전달해 사용자/문서의 중괄호를 템플릿 변수로 해석하지 않는다.
- 모델 출력 최대 1,024 토큰, 저장/전달 문자는 추가로 12,000자 상한. 설정 가능한 상한도 코드에서 제한한다.
- 사용자당 일반 대화·건강 문진 합계 분당 5회, 동시에 1회. 초과 시 429/Retry-After. 단일 백엔드 메모리 기준이며 재시작하면 초기화된다.
- 관리자 문서 임베딩은 별도 공통 요청 한도를 사용하고, 내용 4,000자/파일 16KB까지 허용한다. 형식별 추출·대용량 적재는 4단계 범위다.
- 인증 API는 전체 합계 분당 20회로 제한한다. 두 사용자용 단일 서버 기준이며 다른 요청 때문에 잠시 제한될 수 있다.
- private 프로파일은 Spring AI 자동 재시도 1회 시도로 제한한다. 프록시는 50초 후 504를 반환한다. 이것이 이미 시작된 공급자 작업/과금을 취소한다고 보장하지 않는다.
- 모델 실패 시 질문/답변을 저장하지 않고 실패 상태로 응답한다. 일반/건강 문진 기본 프롬프트의 의사 자칭은 제거했다. 저장된 프롬프트 변경, 대화 이력 전달, 다중 아기 선택 개선은 아직 수행하지 않았다.

private 프로파일의 채팅은 기존 Gemini 2.5 Flash-Lite, 임베딩은 설치된 Spring AI 1.1.5의 dev 기본값인 `gemini-embedding-001`, 3072차원을 명시한다. 기존 V1/차원/임베딩 데이터를 바꾸지 않았다. 모델의 현재 API 이용 가능 여부·응답 품질·결제는 실제 키로 검증하지 않았다.

## 로컬 보안 설정

실제 값은 아래 파일에만 있으며 소스·문서에는 복사하지 않았다. 디렉터리는 Windows 현재 사용자에게 접근을 제한한 기존 보안 경로다.

- `C:/Users/USER/.icare/local-db/private-backend.env`: 허용 이메일, 기존 DB 계정/비밀번호, JWT_SECRET, ICARE_PROXY_SECRET. 두 번째 주소는 ICARE_ALLOWED_EMAILS 값 끝에 쉼표로 추가한다. 변경 후 백엔드를 재시작해야 한다.
- `C:/Users/USER/.icare/local-db/vercel-server.env`: 같은 ICARE_PROXY_SECRET, BACKEND_URL과 Cloudflare 서비스 인증 항목.
- `C:/Users/USER/.icare/uploads`: 업로드 영속 저장 경로.

현재 Gemini API 키, SMTP 계정/앱 비밀번호, 외부 백엔드 URL, Cloudflare 서비스 토큰은 비어 있다. Kakao 키도 필요한 경우 입력한다. 이 값들을 채우기 전 실제 서비스 실행/외부 연결이 준비됐다고 보지 않는다. Google AI Pro 구독과 Gemini API 결제 확인은 별개다.

공유 가능한 빈 예제는 `config/private-backend.env.example`, `config/vercel-server.env.example`이다. 실제 값을 NEXT_PUBLIC_ 변수, Git, 화면 로그에 넣지 않는다.

## 검수 후 실제 백엔드 실행

현재 서비스 DB는 `parenting-postgres`, 기존 네트워크는 `icare-local-db_default`다. `compose.backend.yml`은 DB 서비스나 DB 볼륨을 선언하지 않으므로 기존 DB만 연결한다. 실제 DB에 새 스키마 변경은 없다. 관리자/지식 초기화는 기본 꺼져 있다.

```powershell
Set-Location D:\work\babychatboot
$env:ICARE_BACKEND_ENV_FILE = 'C:/Users/USER/.icare/local-db/private-backend.env'
$env:ICARE_UPLOAD_DIR = 'C:/Users/USER/.icare/uploads'
docker compose -f compose.backend.yml config --quiet
docker compose -f compose.backend.yml build
# 필요한 키 설정과 브랜치 검수 이후 실행
docker compose -f compose.backend.yml up -d
docker compose -f compose.backend.yml ps
```

컨테이너 내부에서는 기존 DB의 Docker 이름으로 연결하고, 호스트 포트는 127.0.0.1:8080만 바인딩한다. DB 역시 127.0.0.1:5432다. 업로드 bind mount의 실제 쓰기 권한은 실행 환경에서 확인한다. 이번 격리 런타임은 이미지 읽기 전용 구성으로 검사했으며 실제 업로드 디렉터리에 파일 쓰기는 하지 않았다.

초기 관리자가 필요하면 허용 이메일을 ICARE_ADMIN_BOOTSTRAP_EMAIL로 지정하고 12자 이상/UTF-8 72바이트 이하의 별도 비밀번호를 설정한다. 생성될 계정·백업을 검수한 뒤에만 ICARE_ADMIN_BOOTSTRAP_ENABLED=true로 한 번 실행한다. 성공 확인 후 false로 되돌리고 초기 비밀번호 항목을 비운 다음 재시작한다. 기존 관리자 행이 있으면 자동으로 덮어쓰거나 추가 생성하지 않는다. 실제 관리자 생성은 이번에 실행하지 않았다.

기존 일반 가입·메일 인증 흐름은 유지한다. 비밀번호는 신규 가입·변경에 12자 이상/UTF-8 72바이트 이하가 적용된다. 기존 비밀번호로 로그인은 가능하다. 한 사용자가 먼저 가입한 뒤 다른 사용자는 초대 코드를 사용해 같은 가족에 합류할 수 있다.

## Cloudflare·Vercel 연결 절차 — 미실행

1. 가비아의 도메인 등록은 유지하고 현재 DNS의 Vercel, MX, SPF/DKIM/DMARC, 기타 레코드를 내보내 보관한다. 네임서버 변경이 필요한지는 실제 도메인/Cloudflare 플랜에서 확인한다.
2. 집 PC에 Tunnel을 구성해 전용 백엔드 hostname을 loopback 백엔드에 연결한다. Tunnel은 연결 통로이며 백엔드 실행 서버는 집 PC다. Cloudflared를 Docker로 실행한다면 localhost의 의미가 달라지므로 내부 네트워크 대상을 다시 확인한다.
3. hostname 전체를 Cloudflare Access 애플리케이션으로 보호하고, **Service Auth** 정책에 이 서비스용 토큰 하나를 지정한다. 광범위한 Allow/Bypass를 두지 않는다. Vercel 서버가 `CF-Access-Client-Id`/`CF-Access-Client-Secret`를 보낸다. [Cloudflare 공식 서비스 토큰 문서](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
4. Vercel 서버 환경변수에 BACKEND_URL(HTTPS origin만), 두 Access 값, ICARE_PROXY_SECRET를 설정한다. Preview/Production별 적용 범위를 구분하고 브라우저 공개 변수로 만들지 않는다.
5. 배포 승인 후 직접 hostname 접근/위조 토큰은 실패하고 서버 전달+허용 사용자 JWT만 성공하는지 확인한다. Access 만료/회전, 집 PC 재시작, Tunnel 중지, 외부 모델 실패도 실제 환경에서 확인한다.

Vercel Functions의 요청/응답 크기 제한은 공식 문서에서 4.5MB다. 이를 고려해 프록시는 4MiB 이내, 파일 업로드는 3MB 이내로 제한했다. CSV가 크면 기간을 줄인다. 함수 최대 시간은 런타임/플랜/설정에 따라 달라지므로 코드의 maxDuration=60이 적용 가능한지 배포 전에 확인한다. [Vercel 제한 문서](https://vercel.com/docs/functions/limitations)

Next 개발 실행만 BACKEND_URL=http://127.0.0.1:8080을 허용하고 Cloudflare 토큰을 생략할 수 있다. 이 경우에도 ICARE_PROXY_SECRET와 사용자 인증은 필요하다. Production 모드의 평문 HTTP 주소는 거부한다. 백엔드 URL을 요청 본문·헤더로 바꿀 수 없고 리다이렉트를 따라가지 않는다.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| 외부 연결 없는 JUnit | 15개 통과; 기존 Flyway DB 테스트 6개는 opt-in 환경변수 미지정으로 이번 실행에서 건너뜀 |
| 핵심 권한 | 서비스 헤더 위조/미설정, 사용자 ADMIN 역할 주입, 다른 가족 일지/CSV/건강 문진/수정/삭제, 비활성 관리자, 삭제/허용 외 사용자, 사용자·관리자 동일 이메일 분리 통과 |
| AI | 입력 초과·동시 호출·분당 한도, 문서 크기·출력 토큰 상한, 실패 시 무저장 및 후속 요청 통과 |
| 서버 프록시 | Node 테스트 5개 통과: 헤더 위조, URL/경로/출처 제한, 리다이렉트/오류 전달, 크기 제한, 이미지 쿠키 범위/로그아웃 |
| Next.js | TypeScript 및 production build 통과. `/api/[...path]` 동적 서버 경로 생성 |
| 브라우저 번들 | `.next/static`에 CF/ICARE 서버 인증 변수 및 NEXT_PUBLIC_API_URL 참조 없음 |
| Docker | Java 17 고정 이미지에서 소스 빌드·비관리자 실행·읽기 전용 루트·healthz·Flyway/JPA 시작 통과 |
| 격리 HTTP | 테스트 가입 7개 검사 및 로그인/날짜 경계/CSV/다른 가족 차단 19개 검사 통과. 다음날 자정 기록을 전날 조회에서 제외 |
| 데이터 | 검증 DB만 합성 사용자 2명/아기 2명/일지 3개. 지식·관리자 0, 거부 요청 후 타 가족 일지 보존. 실제 서비스 DB는 2단계에서 변경하지 않음 |
| 프론트엔드 lint | 기존 오류 7개/경고 11개 남음. 관리자 로그인 any 오류 하나는 수정. 새 프록시/인증 변경의 lint 오류 없음 |

검증 DB: `icare_validation_private_20260908`, 컨테이너: `icare-flyway-validation`. 백엔드 검증 컨테이너는 `icare-backend-validation`, 외부 인터넷이 차단된 내부 Docker 네트워크만 사용했다. AI/메일 호출 없이 가짜 키로 시작했고 실제 사용자 정보를 fixture에 사용하지 않았다.

최종 실행 Docker 이미지 ID: `sha256:80b50acd02e78d754ff4a02376b52c9bc7c79bcef47b6b10fd31af263feed9af`. 검증 후 테스트 컨테이너는 중지하고 DB/파일은 보존한다.

재검증:

```powershell
# backend: 일반 테스트는 실제 DB/AI를 실행하지 않음
Set-Location D:\work\babychatboot\babychatboot_backend\parenting
.\mvnw.cmd test
# frontend
Set-Location D:\work\babychatboot\babychatboot_frontend\chat-frontend
node --experimental-strip-types --test tests/api-proxy.test.mjs
npm.cmd run build
# 준비된 격리 컨테이너가 실행 중일 때만: 라벨·검증 DB·내부 네트워크를 먼저 확인함
Set-Location D:\work\babychatboot
.\scripts\Test-PrivateBackend.ps1 -Mode verify
```

남은 lint 오류는 기존 관리자 admins/documents의 any, dailylogs/posts/users의 effect 상태 변경, signup의 any다. 전체 UI 정리는 이번 기능에 포함하지 않았다. 실제 Gemini/SMTP, Cloudflare 정책, Vercel 배포, 실제 업로드/브라우저 전 과정은 미검증이다. 최근 대화 전달과 문서 버전/출처 개선은 3·4단계 후속 범위다.

## 중지·복구·승인

문제가 있으면 `docker compose -f compose.backend.yml stop`으로 백엔드만 중지하고 검수된 이미지/환경설정으로 수정한다. 이 기능은 V1 SQL/서비스 스키마를 변경하지 않았다. 애플리케이션 중지에 DB 볼륨 삭제나 초기화는 필요하지 않다. 데이터 복구가 실제 필요한 경우에만 [Flyway 작업서](FLYWAY_RUNBOOK.md)의 백업/복원 검수 절차를 따른다.

후속 사용자 승인으로 2단계 52245b7을 main에 병합하고 feat/chat-context에서 3단계를 진행했다. 원격 push, 실제 DNS 변경/Vercel 배포, 실제 관리자/지식 생성·교체는 수행하지 않았다. 현재 소스에는 V2가 있으므로 실제 DB 연결 전 [3단계 작업서](CHAT_CONTEXT_RUNBOOK.md)의 별도 적용 승인을 받는다. 4단계 브랜치 구성은 아직 검수 전이다.
