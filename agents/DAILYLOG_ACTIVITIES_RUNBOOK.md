# 하루일과 이유식·낮잠 (2026-09-19)

사용자가 `feat/dailylog-feeding-naps` 구성을 승인했다. main/dev의 b22009f에서 분기했다. 이 문서는 실제 DB 적용 검수안이며, 아래 승인 대기 상태를 적용 완료로 해석하지 않는다.

## 변경

- 수유·이유식·낮잠·기저귀·메모 빠른 등록, 선택 항목만 펼치는 입력창, 시간순 카드와 기록 요약. 기존 복합 기록도 함께 수정할 수 있다.
- 이유식: 음식명(최대 100자), 먹은 양(선택, 1~1000g). 양 미입력은 NULL/미기록이며 0g로 저장하지 않는다. 숫자 상한은 입력 오류 방지 기준이지 권장 섭취량이 아니다.
- 낮잠: 기록시각이 시작, 종료시각을 별도 저장. 종료는 시작 이후 24시간 이내. 날짜를 넘기면 시작 날짜에 집계하며 하루 전체 수면으로 해석하지 않는다.
- `/api/logs/capabilities`로 백엔드의 새 항목 지원을 확인한다. 적용 전 구버전 백엔드에서는 이유식·낮잠 입력을 비활성화해 새 필드가 조용히 유실되는 것을 막는다.
- 화면/서버 입력 검증, 실패 시 폼 유지, 수정·삭제, 날짜/아이별 접근 통제 유지. CSV와 관리자 조회에도 새 필드 포함. CSV의 수식 시작 문자는 중화한다.
- native dialog의 포커스 가두기·복원/Esc, label 연결, 입력 오류 알림, 큰 조작 영역, 320/375px 카드와 줄바꿈. 스크린리더 실제 기기/모든 브라우저 인증은 수행하지 않았다.
- AI에는 새 기록을 부모 입력 사실로만 요약시킨다. 현재 승인된 출처 2개의 범위를 넓히지 않고 적정 이유식량·수면량 판단을 금지한다. 이번 작업은 실제 Gemini를 호출하지 않았다.
- 프론트 경고 6개: 관리자 채팅 미사용 인자 1개 제거, 아기/마이페이지/게시판 상세 조회 함수의 안정적 의존성, 게시판 목록·작성 초기화의 URL 의존성/늦은 응답 정리. 상세 페이지의 SSR 중 localStorage 직접 접근도 기존 인증 상태 훅으로 변경했다. ESLint 규칙을 비활성화하지 않았다.

## 실제 DB 승인 대상

V1~V3와 기존 데이터는 수정하지 않는다. V4 SQL:

```sql
ALTER TABLE daily_logs
    ADD COLUMN solid_food_name varchar(100),
    ADD COLUMN solid_food_amount integer,
    ADD COLUMN nap_end_time timestamp(6);
```

파일: `babychatboot_backend/parenting/src/main/resources/db/migration/V4__daily_log_food_and_naps.sql`
SHA256: `BCE2806527D3BAC13D34F527E86761B3233CA7F39053D12ED98B442EAB49CC0F`
격리 검증 Flyway checksum: `1753911540`.

최신 백업: `C:/Users/USER/.icare/backups/20260919-before-dailylog-v4/database.dump` (120638 bytes).
SHA256: `AAE69BCE5EA5D0F7ED4E21D6FBF404B1CD67A6007300AB8668509F95CB0B8830`.
실제 DB를 읽기 전용으로 비교해 `icare-rag-validation`의 신규 DB `icare_validation_20260919_dailylog_v4`에 복원했다. 16개 테이블의 행 수/전체 행 해시 및 13개 시퀀스 일치. 이 복원 DB에만 V4 적용 후 기존 컬럼의 행 해시 보존을 재확인했다. 근거는 백업 폴더의 restore-verification.json, preserved-table-hashes.jsonl, preserved-sequences.jsonl과 validation-migration.log.

## 검증

- 백엔드 79개 중 72개 통과, 환경 선택 7개 제외, 실패 0. 신규 서비스 검사 5개: 등록/수정/미기록, 잘못된 입력 거절, 기존 수유 호환, AI 사실 입력, CSV 새 항목/수식 중화.
- 실제 격리 PostgreSQL: 빈 DB V1~V4/JPA validate, baseline 및 V1·V3 업그레이드 보존, 새 필드 재조회, 벡터 보존. 실제 데이터 복원 검증은 위 별도 절차로 완료했다.
- 프론트 Node 12개 통과. Chrome 합성 API 검사: 이유식 필수값/양 생략/수정/재조회, 저장 실패 후 입력 유지, 낮잠 역전 차단/자정 통과, 삭제, 320/375px 넘침 없음, Tab 포커스 유지/Esc/포커스 복귀, JS 오류 없음. 기존 RAG 출처·아이/날짜 전환 검사도 통과.
- 전체 ESLint 오류 0/경고 0, TypeScript 및 백엔드 JAR 빌드 통과.
- Next production webpack 빌드 통과. 첫 빌드는 빌드 출력 폴더 안에 로그를 열어 Windows 파일 잠금으로 실패했고, 로그를 별도 target 폴더로 옮겨 재실행해 통과했다.
- 실제 사용자 일지 생성·삭제, 메일, 유료/무료 AI 호출은 하지 않았다.

## 적용·복구 순서

현재 실제 DB 적용은 승인 대기다. 승인 후 로컬 백엔드를 중지해 쓰기를 막고, 백업 이후 실제 행/시퀀스 변화가 있으면 새 백업·복원 검증부터 수행한다. `.env`의 DB 연결값을 출력하지 않고 `ICARE_DB_*` 프로세스 환경변수로 지정해 `scripts/db/Invoke-Flyway.ps1 -Action migrate -VectorDimensions 3072`를 실행한다. V4만 추가 적용됐는지와 기존 행 해시/시퀀스를 확인하고 배포 스키마 허용 목록에 검수한 V4 체크섬/해시를 추가한다. 백엔드를 재기동해 readiness 및 새 필드 응답을 확인한다.

SQL 실패는 PostgreSQL/Flyway 트랜잭션 롤백 상태를 확인한다. 앱 문제는 기존 b22009f 코드로 복구할 수 있으며 추가 nullable 컬럼은 삭제하지 않는다. DB 전체 복구가 필요하면 현재 상태를 별도 백업하고 새 격리 DB에 검증 백업을 복원한 뒤 연결 전환을 별도 승인받는다. 새 기록이 생긴 뒤 과거 덤프로 실제 DB를 덮어쓰면 유실되므로 금지한다. Flyway clean/기존 지식 삭제/재임베딩은 하지 않는다.

main/dev 병합과 원격 push는 이번 기능의 별도 승인 대상이다. 외부 배포는 수행하지 않는다.
