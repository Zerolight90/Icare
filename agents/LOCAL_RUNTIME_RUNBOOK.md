# 로컬 실행 정리 (2026-09-19)

승인 브랜치: feat/local-runtime → feat/redis → feat/blue-green-deploy. 각각 main 병합은 별도 검수한다. 새 요청은 기존 이메일 두 명 제한을 일반 회원가입으로 대체하고, 로컬은 호스트 앱 + Docker DB/Redis, 이후 PC Docker 배포 준비로 확장한다. 실제 DNS/외부 배포는 아직 범위 밖이다.

## 완료

- AccountPolicy는 이메일 형식/비밀번호만 검사한다. 모든 정상 이메일로 가입할 수 있으며 이메일 인증, 관리자 역할 분리, 가족별 권한, 서버 프록시 인증은 유지한다.
- 기본 Compose는 기존 외부 DB 볼륨만 재사용하고 127.0.0.1:5432만 사용한다. 구 기본 비밀번호와 앱 자동 실행을 제거했다. Redis는 다음 브랜치에서 추가한다.
- dev/prod도 환경변수 기반 private 설정을 공유한다. 오래된 768차원 운영 설정과 secret 프로파일 자동 포함을 제거했다. 기존 3072차원 임베딩/DB를 유지한다.
- 실제 Gemini/JWT/DB/프록시/SMTP/Kakao 값은 Git에서 제외한 루트 .env에서 관리한다. 구 YAML과 프론트 .env.local은 C:/Users/USER/.icare/local-runtime-20260919에 백업하고 소스 폴더에서 제거했다. 새 Gemini/JWT 값은 보존했다.
- SMTP 비밀번호와 Kakao REST 키는 기존 설정을 옮겼으나 유효성은 미검증이다. SMTP_USERNAME이 비어 있다. 브라우저 지도 JavaScript 키는 .env에서 공급하더라도 브라우저에 공개되는 키다. 공급자 콘솔에서 허용 도메인을 제한한다.
- 프론트 Docker 컨텍스트의 .env/빌드/의존성 제외를 추가했다. Dockerfile/배포 구성은 배포 브랜치에서 정리한다.
- 종료된 과거 검증 앱 컨테이너 6개와 앱 이미지 5개를 삭제했다. 실제 DB 볼륨·원본 postgres_data·백업을 보존했다. 검증 후 격리 DB 컨테이너와 호스트 테스트 앱도 종료·제거했다. 합성 DB 파일은 Git 밖에 보존한다. 사용하지 않는 Java 이미지 2개와 빌드 캐시도 정리했으며 캐시 회수량은 4.648GB다. Docker에는 실제 PostgreSQL 컨테이너/이미지와 기존 볼륨만 남았다.

## 검증

- Maven clean package: 40개 중 29개 통과, 명시적 DB 검증 11개 제외, 실패 0. 이메일 허용/미인증 차단/역할 주입/가족 권한 회귀 포함.
- PC의 Java로 새 JAR를 직접 실행, 격리 DB의 V3/Hibernate 확인 후 HTTP 48개 통과(권한 19, 맥락 16, 지식 미리보기 13). 합성 계정 사용. 실제 AI/메일 호출 없음.
- .env 파서·프론트 전달 목록·실행기 사전 점검 통과. Compose DB 볼륨/로컬 포트 확인. 추적 소스의 실제 자격증명 문자열과 JAR secret 파일 포함 여부 검사 통과.
- 실제 DB 변경 없음. 실제 사용자 이메일 가입/메일/지도/AI 전체 흐름은 미검증. Redis·배포 파이프라인은 아직 미구현.

- 호스트 Next.js 검사 3개 통과: 가입 화면 200, 프록시 관리자 역할 주입 400, 외부 출처 403. 기본 Turbopack 최초 컴파일은 45초 시간 초과했으며 webpack 재검증은 정상 통과했다. 실행기에 -Webpack 옵션을 추가했다.

## 로컬 실행

저장소 루트에서 별도 터미널마다 실행한다.

```powershell
./scripts/Start-IcareLocal.ps1 -Service backend
./scripts/Start-IcareLocal.ps1 -Service frontend -Webpack
```

프론트 주소: http://127.0.0.1:3000. DB가 이미 실행 중이면 재생성할 필요가 없다. SMTP_USERNAME을 본인 SMTP 발신 계정으로 입력하고 기존 SMTP_PASSWORD의 유효성을 확인해야 실제 가입 인증을 완료할 수 있다. 비밀번호/API 키를 대화나 Git에 붙여 넣지 않는다.

복구: 기존 main 커밋 e3387a2와 프로젝트 밖 설정 백업을 기준으로 코드/환경설정을 복구한다. 이번 변경은 스키마를 바꾸지 않았다. 실제 DB 백업/복구는 기존 Flyway 작업서를 따른다. 구 Docker 기본 파일은 안전하지 않으므로 복구 후에도 실행하지 않는다.

사용량: 이번 확장 시작 17%, 첫 단계 조회 18%(동일 주간 창). 과거 창 누적의 정확한 총량은 복원할 수 없다.
