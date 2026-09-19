# 로컬 .env 설정과 Gemini 연결

2026-09-19, 4단계 실제 V3 적용 이후의 환경설정 변경이다. 사용자 승인으로 `feat/env-config`의 `129b106`을 main에 fast-forward 병합했다. 이번 병합에서 실제 DB 변경/외부 배포/새 계정 생성은 하지 않았다. 최신 완료 범위는 [현재 상태](CURRENT_STATUS.md)를 따른다.

## 설정 위치

로컬 실행의 기준은 저장소 루트 `.env`다. 사용자가 입력한 GEMINI_API_KEY와 기존 JWT_SECRET을 그대로 보존하고 기존 외부 파일의 DB·서비스 인증·허용 이메일 설정을 합쳤다. 두 번째 이메일 추가 위치는 주석으로 남겼다. Git에 넣는 파일은 값이 비어 있는 [.env.example](../.env.example)뿐이다. 실제 `.env`는 Git 제외를 확인했다.

기존 파일은 삭제하지 않았다. 변경 전 루트 사본은 `C:\Users\USER\.icare\env-config-20260919\root-before.env`, 이전 외부 설정은 `C:\Users\USER\.icare\local-db\`에 있다. 루트 .env와 예전 외부 파일을 동시에 수정하며 사용하지 말고 실행할 때 어느 파일을 읽는지 확인한다. 이 사본도 비밀값을 포함하므로 Git/공유 문서에 복사하지 않는다.

| 변수 | 용도 |
| --- | --- |
| GEMINI_API_KEY / GEMINI_CHAT_MODEL | Gemini 키와 채팅 모델 |
| JWT_SECRET | 사용자/관리자 토큰 서명. 변경하면 기존 토큰은 재로그인 필요 |
| ICARE_PROXY_SECRET | Next 서버와 백엔드 사이의 서비스 인증. 양쪽에 같은 값 필요 |
| ICARE_DB_URL / USER / PASSWORD | 기존 DB 연결. 새 DB 생성이나 DB 비밀번호 변경 명령이 아님 |
| ICARE_DB_VOLUME / NETWORK / PORT | 기존 Docker DB 볼륨/네트워크/포트. DB Compose를 임의 재생성하지 않음 |
| ICARE_ALLOWED_EMAILS | 허용 이메일 1~2개. 쉼표로 추가 |
| ICARE_FRONTEND_ORIGIN | 브라우저에서 사용하는 정확한 origin. 로컬 기본 http://127.0.0.1:3000 |
| ICARE_CORS_ALLOWED_ORIGINS | 백엔드 CORS의 정확한 허용 origin 목록. 기본 빈 값은 교차 출처 요청 거부 |
| BACKEND_URL / CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET | Next 서버의 전달 대상과 Cloudflare 서비스 인증 |
| SMTP_HOST / PORT / USERNAME / PASSWORD | 가입 인증 메일. 현재 계정/앱 비밀번호 미설정 |
| KAKAO_REST_API_KEY / NEXT_PUBLIC_KAKAO_MAP_KEY | 서버 REST 키 / 브라우저 지도 JavaScript 키. 서로 다른 키 |
| ICARE_UPLOAD_DIR | 호스트 업로드 경로. Docker 안에서는 /app/uploads로 덮어씀 |
| ICARE_AI_MAX_INPUT_CHARS / MAX_OUTPUT_TOKENS / CALLS_PER_MINUTE | 기존 AI 요청 보호 한도. 과금 차단 장치는 아님 |

실제 키를 NEXT_PUBLIC_ 변수로 바꾸지 않는다. 프론트 실행기는 필요한 전달 설정과 지도 공개 키만 선택해 전달하며 Gemini/JWT/DB 비밀번호를 루트 파일에서 프론트 프로세스로 넘기지 않는다. 서버 프록시 인증값도 브라우저에 공개되지 않는다.

변수는 한 줄의 `NAME=value` 형식이다. $, #, 공백이 있는 값은 작은따옴표로 감싼다. 실행기는 변수 치환이나 명령 실행을 하지 않고 그대로 읽는다. 여러 줄, 중복 키, inline 주석, 큰따옴표 escape는 지원하지 않는다. 이 형식은 Docker Compose의 .env 리터럴과도 맞춘 것이다.

## 실행 방법

저장소 루트의 PowerShell에서 먼저 값의 존재만 검사한다. 이 검사는 서버/DB/API를 호출하지 않는다.

```powershell
./scripts/Start-IcareLocal.ps1 -Service backend -CheckOnly
./scripts/Start-IcareLocal.ps1 -Service frontend -CheckOnly
```

로컬 Java/Next 실행은 터미널을 각각 열어 다음을 사용한다.

```powershell
./scripts/Start-IcareLocal.ps1 -Service backend
./scripts/Start-IcareLocal.ps1 -Service frontend
```

브라우저 주소는 `http://127.0.0.1:3000`이다. 주소/포트를 바꾸면 ICARE_FRONTEND_ORIGIN도 맞춘다. backend 실행기는 private 프로파일을 명시하며 dev/prod의 과거 application-secret 파일을 자동 포함하지 않는다. 그냥 Maven을 실행하면 기본 dev 프로파일이며 루트 .env가 자동으로 로드되지 않으므로 위 실행기를 사용한다. 프로그램 종료 후 실행기가 바꾼 프로세스 환경변수는 원래 값으로 복구한다.

Docker 백엔드는 다음과 같이 .env를 명시한다. 실제 실행은 기능 브랜치 검수 후 진행하며 DB는 기존 컨테이너를 사용한다.

```powershell
docker compose --env-file .env -f compose.backend.yml config --quiet
docker compose --env-file .env -f compose.backend.yml build
docker compose --env-file .env -f compose.backend.yml up -d
```

실제 환경에서는 `config` 출력 전체에 키가 포함되므로 반드시 `--quiet`를 사용한다. 이전 셸에 ICARE_BACKEND_ENV_FILE이 설정되어 있으면 그 파일이 우선하므로 루트 .env를 사용할 때는 해당 선택 변수를 비운다. `compose.backend.yml`은 컨테이너의 DB 주소를 parenting-postgres로, 업로드 경로를 /app/uploads로 맞춘다. 루트 docker-compose.yml 전체 실행은 이 절차가 아니다. 브랜치 검수·병합은 완료했지만 실제 앱 시작은 아직 하지 않았다.

Vercel은 로컬 .env를 자동으로 읽지 않는다. 배포 승인 시 서버용 변수만 Vercel 프로젝트의 환경변수에 설정해야 한다. 이번에 DNS/Vercel 설정을 변경하지 않았다.

## CORS와 인증

브라우저는 같은 출처의 Next `/api`를 사용하므로 백엔드 CORS 허용 목록은 비워도 된다. 필요한 경우 `https://app.example.com,http://127.0.0.1:3000`처럼 정확한 주소를 입력한다. 별표/와일드카드, 경로, 자격증명이 포함된 URL은 시작 시 거부한다. HTTP는 loopback만 허용한다.

CORS 허용은 서비스/JWT 인증을 대신하지 않는다. 브라우저에 X-Icare-Proxy-Secret을 전달하지 않으며 해당 헤더의 CORS 허용도 하지 않는다. 허용 origin의 실제 요청도 서비스 인증이 없으면 403이다. Next는 ICARE_FRONTEND_ORIGIN과 다른 브라우저 origin/교차 사이트 요청을 계속 거부한다.

## 실제 Gemini 확인 결과

사용자 화면에서 Free 등급을 확인했다. 초기 모델 gemini-2.5-flash-lite 요청은 Google이 신규 사용자에게 더 이상 제공하지 않는다는 404를 반환했다. 모델 목록 조회에는 남아 있어 목록만으로 사용 가능하다고 판단하지 않았다.

Google 오류가 안내한 gemini-3.5-flash-lite의 [공식 무료 등급](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)을 확인하고 루트 .env의 GEMINI_CHAT_MODEL을 이 값으로 설정했다. 합성 문장으로 답변 1회와 기존 gemini-embedding-001의 3072차원 임베딩 1회가 성공했다. API 테스트는 스키마·문서를 변경하거나 실제 가족 정보를 전송하지 않는다. 유료 결제 설정은 하지 않았다.

`scripts/Test-GeminiConnection.ps1`은 위 두 요청을 실행하며 실패 시 재시도나 다른 모델로 자동 전환하지 않는다. 필요할 때만 실행한다. 출력에는 키/답변/벡터 원문을 포함하지 않는다. 이 검사는 REST 연결이며 실제 Spring AI 앱의 전체 상담·검색 품질 검증과는 구분한다. 무료 등급 한도/모델 제공 상태는 Google에서 달라질 수 있다. Google AI Pro 구독을 API 무료 보장으로 해석하지 않는다.

임베딩 모델/차원은 기존 값을 유지한다. 채팅 모델을 바꾸기 위해 기존 벡터를 삭제하거나 재생성하지 않았다. API 키 발급 및 요금제 확인은 [공식 키 안내](https://ai.google.dev/gemini-api/docs/api-key), [과금 안내](https://ai.google.dev/gemini-api/docs/billing)를 따른다.

## 검증·복구·다음 작업

- 일반 JUnit 27개 통과(명시적 DB 환경이 필요한 11개 제외). CORS 허용/거부/서비스 인증 유지, 환경변수 바인딩, private 프로파일의 secret 제외를 포함한다. 스키마 변경이 없어 기존 전체 DB 마이그레이션 검사를 반복하지 않았다.
- 프론트 프록시/상태/출처 Node 테스트 9개 통과. 프론트 애플리케이션 코드는 변경하지 않았다.
- PowerShell 환경 파일의 리터럴 보존, 중복/잘못된 구문 거부, 프론트 변수 선택, CheckOnly의 환경 비변경 검사 통과. Docker Compose 설정 검사 통과.
- 새 Docker 이미지에서 private 프로파일/Flyway V3/JPA validate/healthy와 HTTP 인증·일지 19개, 대화 16개, 문서 13개(합계 48개) 통과. 첫 시작은 검증 DB 준비 전 연결 거부로 실패했고, pg_isready 확인 후 재시작해 통과했다. 실제 앱은 시작하지 않았다.
- Compose의 해석된 환경변수에서 루트 키/JWT/서비스 인증/채팅 모델/CORS 값과 컨테이너 DB·업로드 경로 덮어쓰기를 값 출력 없이 대조했다. 입력값 존재 검사만으로 연결 완료라고 판단하지 않았다.
- 실제 API 키는 Git 제외 및 커밋 내용 미포함으로 검사한다. 백엔드 Docker 컨텍스트는 루트 .env를 포함하지 않고 기존 secret 파일도 제외한다.

문제가 있으면 해당 로컬 앱/검증 백엔드만 중지하고 이전 main 코드와 C:의 변경 전 환경 파일로 복구한다. 환경 파일을 복구하기 전에 새로 입력한 값이 있는지 비교·보존한다. 기존 DB/마이그레이션은 되돌리지 않는다. JWT/DB 비밀번호를 임의 회전하지 않는다.

남은 작업: SMTP 설정과 실제 가입·상담·검색 전체 흐름 확인, Cloudflare/Vercel 연결 준비. 자동 관리자 생성/실제 지식 등록·교체/외부 배포는 기존 별도 승인 원칙을 유지한다.
