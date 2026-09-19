# Redis 적용 (2026-09-19)

feat/redis. 이전 로컬 실행 브랜치 29a7b26은 사용자 계속 진행 승인으로 main에 병합했다. Redis 기능은 별도 병합 검수 대상이다.

## 동작

- Docker는 기존 PostgreSQL과 Redis 7.4 공식 고정 이미지 두 개만 상시 사용한다. Redis는 127.0.0.1:6379, 비밀번호는 루트 .env, 메모리 상한 64MB, 저장 파일/볼륨 없음이다. 제어 키가 메모리 압박으로 사라지지 않도록 noeviction을 사용한다.
- 게시글 목록 DTO만 Redis에 30초 캐시한다. 원본 게시글·채팅·아기 프로필은 PostgreSQL에 유지한다. 페이지 크기는 최대 50, 페이지 번호는 0~1000이다. 게시판 활성 상태는 DB에서 확인한다.
- 글/댓글 생성·변경·삭제, 관리자 삭제·복원/게시판 변경, 닉네임 변경과 조회수 변경은 DB 커밋 후 캐시 세대를 갱신한다. 경합 중 오래된 조회가 캐시를 다시 채워도 다음 세대에서는 읽지 않는다. Redis 장애 시 DB 조회로 대체하며, 캐시 무효화 실패 시 기존 캐시는 최대 30초 남을 수 있다.
- AI 빈도 제한과 사용자당 한 요청, 로그인/가입/인증 경로의 기존 전체 20회/분 제한을 서버들이 Redis로 공유한다. Redis에 사용자 이메일 원문 대신 SHA-256 식별자를 사용한다. AI 메시지 본문/응답은 넣지 않는다.
- AI 임대는 120초이며 소유 토큰이 맞아야 해제할 수 있다. 트랜잭션 커밋 직전 또는 비트랜잭션 반환 시 임대 소유권을 다시 확인한다. 임대 만료/Redis 장애 시 503으로 실패하고 응답/DB 쓰기를 성공으로 처리하지 않는다. 정상 요청은 DB 트랜잭션 종료까지 잠금을 유지한다.
- Redis 장애 시 AI/인증 요청을 차단하고 서버별 메모리 제한으로 우회하지 않는다. Redis 재시작으로 임시 카운터가 사라지므로 고가용성/과금 상한을 보장하는 시스템은 아니다. 기존 입력/출력 제한과 API 프로젝트 무료 등급 확인도 유지한다.

## 실행

```powershell
docker compose --env-file .env up -d --no-deps redis
./scripts/Start-IcareLocal.ps1 -Service backend
./scripts/Start-IcareLocal.ps1 -Service frontend -Webpack
```

DB가 이미 실행 중이면 재생성하지 않는다. 실제 서비스 DB의 스키마·행 변경은 없다. Redis 원본 데이터 복구 작업은 필요하지 않으며 재시작 뒤 캐시는 DB에서 재생성된다. 메모리 가득 참/연결 장애 시 인증·AI는 Redis 복구 후 재시도한다.

## 검증

Maven 전체 44개 중 33개 통과/명시적 DB 테스트 11개 제외. 추가 동시성 검사까지 Redis 통합 4개 통과(최종 고유 테스트 총 45개 중 34개 통과). 서로 다른 제어 인스턴스의 공유 한도, 8개 동시 진입 중 한 소유자, 만료된 토큰의 새 잠금 해제 차단, 커밋 직전 소유권 재확인, 캐시 적중/커밋 후 무효화/이전 세대 재적재, 장애 시 차단/DB 조회 대체를 확인했다. JAR 빌드 통과. 실제 Redis를 사용하되 테스트 DB 15/고유 test: 접두사만 사용하고 FLUSHDB를 호출하지 않는다.

구현 근거: [Spring Data Redis 스크립트](https://docs.spring.io/spring-data/redis/reference/redis/scripting.html), [Redis 잠금의 만료·소유 토큰](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/).

이번 재개 사용률 18→19%. 과거 조회 구간 포함 관찰 증가 하한 20%포인트를 중간 보고했다. 정확한 총 프로젝트 사용량은 미상이다.

호스트 JAR + 격리 PostgreSQL + Redis 연결의 HTTP 회귀 48개도 통과했다(권한 19, 맥락 16, 지식 미리보기 13). 프론트/백엔드 Docker 실행, 실제 AI/메일 호출, 실제 DB 변경은 하지 않았다.
