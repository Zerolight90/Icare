# iCare 현재 상태

2026-09-19 로컬 테스트·Redis·배포 준비 기준. 로컬 main에는 사용자 승인으로 29a7b26(환경변수 통합/일반 가입)을 병합했다. Redis 9876cad와 그 위의 배포 브랜치는 구현·로컬 검증 후 별도 병합 검수 대상이다. 원격 push/DNS/외부 배포는 하지 않았다.

## 현재 실행과 변경

- Docker에는 기존 PostgreSQL과 Redis만 상시 실행하며 둘 다 loopback에만 포트를 연다. DB 원본·기존 볼륨·백업을 보존했다. 임시 검증 앱/DB/프록시는 정리했다.
- 로컬 프론트와 백엔드는 PC에서 직접 실행한다. 모든 서버 민감값은 Git에서 제외한 루트 .env로 통합했다. 공개 지도 JavaScript 키는 브라우저에서 보이는 용도다.
- 일반 이메일로 회원가입할 수 있다. 이메일 인증, 관리자 역할 분리, 사용자/가족 권한, 서버 프록시 인증은 유지한다. 고정 이메일 제한은 제거했다.
- 게시글 목록은 Redis 30초 캐시를 사용하고 변경 커밋 후 무효화한다. AI/인증 횟수와 AI 중복 요청 제어를 Redis로 공유한다. 채팅·게시글·아기 정보 원본은 PostgreSQL이다.
- 기존 Flyway V1~V3/3072차원 임베딩/최근 대화·아이 범위/문서 검토·버전·출처 기능을 유지한다. 이번 후속 작업에서는 실제 DB를 변경하지 않았다.
- 향후 집 PC Docker 배포용 blue/green 구성, 준비 상태 검사, Nginx 전환·복구, CI/수동 배포 워크플로를 준비했다. DB 자동 변경은 검수한 이력/파일 해시 검사로 차단한다.

## 검증과 한계

백엔드 35개 통과/선택 DB 검사 11개 제외, Redis 단계 호스트 API 48개, 프론트 Node 10개, JAR/Next standalone 빌드·타입 검사 통과. 전체 프론트 lint는 오류 0/기존 경고 9다. 실제 Nginx와 합성 호스트 서버로 전환·진행 중 요청 유지·정적 파일·실패 복구를 검증했다. 최종 호스트 백엔드의 DB 장애 시 readiness 503/liveness 200도 확인했다.

실제 가입메일, Spring AI를 통한 실제 사용자 상담 전체 흐름, 실제 Docker 앱 이미지와 blue/green 전체 배포, GitHub CI 실행/runner 설정, 외부 도메인 연결은 아직 검증하지 않았다. 기존 합성 Gemini REST 연결 성공을 전체 앱 검증으로 대신하지 않는다. 기존 원본 파일 CRC 오류를 복구한 것으로 표현하지 않는다.

## 지금 로컬 테스트

```powershell
./scripts/Start-IcareLocal.ps1 -Service backend
./scripts/Start-IcareLocal.ps1 -Service frontend -Webpack
```

현재 실제 .env로 프론트·백엔드를 이미 호스트에서 실행 중이다. readiness/가입 화면/인증 경계 검사도 통과했다. 주소: http://127.0.0.1:3000. 사용자가 SMTP 설정을 입력한 뒤 Gmail TLS 연결·로그인 성공을 확인하고 백엔드를 재시작했다. 재시작 후 readiness/가입 화면은 200이다. 메일은 보내지 않았으므로 실제 가입 인증메일 수신·인증 완료는 여전히 미검증이다. 지도 REST 키도 기존 설정을 이전했으므로 실제 호출 확인이 남아 있다. 실제 관리자 초기 생성은 별도 설정/검수 후 진행한다.

상세 변경·복구: [로컬 실행](LOCAL_RUNTIME_RUNBOOK.md), [Redis](REDIS_RUNBOOK.md), [배포 준비](DEPLOYMENT_RUNBOOK.md). 실제 DB 복구는 [Flyway](FLYWAY_RUNBOOK.md), 지식 데이터 등록·교체는 [문서 검색](KNOWLEDGE_RUNBOOK.md)의 별도 승인 절차를 따른다. 공식 의료 문헌 수집·DOCX 작성은 여전히 별도 작업이다.

현재 실행 중인 로컬 앱 종료: ./scripts/Stop-IcareLocal.ps1. Docker DB/Redis는 유지한다. 재시작은 위 실행 명령을 별도 터미널에서 사용한다. 환경변수를 바꿨으면 앱을 재시작한다.
