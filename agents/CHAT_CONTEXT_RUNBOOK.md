# 3단계: 대화 맥락 검수와 실행

2026-09-08: 사용자 승인으로 2단계 52245b7을 main에 병합하고 `feat/chat-context`를 생성했다. 이 문서의 3단계 구현은 검수용이며 main 병합과 실제 DB V2 적용은 아직 하지 않았다.

## 변경된 동작

- 새 상담에서 일반 상담 또는 본인 가족의 아이를 직접 선택한다. 기본은 일반 상담이며 아이가 한 명이어도 임의 선택하지 않는다. 상담 도중 아이를 바꾸려면 새 상담을 만든다.
- 새 방 생성 API는 `POST /api/chat/rooms?title=...&babyId=...`이며 babyId는 선택 사항이다. 방의 contextVersion/contextBabyId만 화면에 전달하고 가족 ID와 사용자 엔티티는 숨긴다.
- `ChatContextService`가 매 요청에서 방 소유자, 생성 당시 가족과 현재 가족의 일치, 선택한 아이의 현재 가족 권한을 확인한다. 가족 변경이나 아이 삭제·이동으로 권한이 사라지면 AI 호출 전에 차단한다.
- 최근 USER/ASSISTANT 메시지 12개를 DB에서 제한 조회한다. 시간순으로 최대 6쌍, 합계 6,000자, 메시지당 2,000자 이내의 완성된 질문·답변만 전달한다. 길이가 넘으면 해당 쌍과 그 이전 기록을 제외하며 문장 중간을 자르지 않는다. SYSTEM 기록과 짝 없는 기록은 제외한다.
- 요청 순서는 고정 역할/운영 설정/선택 프로필/검색 자료 → 이전 질문·답변 → 현재 질문이다. 이전 답변은 Assistant 역할로 전달한다. 전체 24,000자, 사용자 입력 4,000자, 출력 기본 1,024토큰 제한을 유지한다. 이는 문자 제한이며 정확한 입력 토큰 계측은 아니다.
- 선택한 아이의 부모 입력 이름·생년월일·월령·성별·키·체중·특이사항만 제한 길이로 참고한다. 미기록은 알 수 없음이며 측정일 없는 키·체중을 현재 값으로 보장하지 않는다. 일지 자동 요약은 이번 범위가 아니다.
- 일반 채팅과 건강 문진 모두 육아 정보 안내 AI라는 고정 역할을 사용한다. 의사 자칭 형태의 기존 운영 프롬프트는 실행 시 기본값으로 대체하고 DB 원문을 덮어쓰지 않는다. 정규식은 모든 표현의 의미를 판별하는 장치가 아니며 실제 답변 품질은 별도 확인이 필요하다.
- 서비스 DB의 system_prompt와 채팅방은 읽기 전용 확인 당시 각각 0행이었다. 기존 설정이나 지식을 수정·삭제하지 않았다.
- AI 실패 시 질문·답변을 저장하지 않으며 저장 트랜잭션 완료까지 같은 사용자의 동시 AI 요청/기록 삭제를 막는다. 이 제한은 단일 백엔드 프로세스 기준이다.
- 방을 이동한 뒤 도착한 오래된 기록 응답이 현재 화면을 덮어쓰지 않도록 검사한다. 같은 방 재선택으로 기록이 비워지는 문제와 답변 저장 후 조회 실패 때 질문을 다시 제출하도록 복원하는 문제도 방지했다.

## V2 SQL과 호환성

검수 파일: [V2__chat_context_scope.sql](../babychatboot_backend/parenting/src/main/resources/db/migration/V2__chat_context_scope.sql).

```sql
ALTER TABLE chat_room ADD COLUMN context_version integer NOT NULL DEFAULT 0;
ALTER TABLE chat_room ADD COLUMN context_family_id bigint;
ALTER TABLE chat_room ADD COLUMN context_baby_id bigint;
```

기존 행의 context_version은 0, 두 ID는 NULL이다. 기존 대화는 읽을 수 있지만 이어서 AI 상담을 하려면 새 방을 만들어야 한다(409 응답). 이전 기록에 가족·아이를 자동 지정하지 않는다. ID는 생성 당시 범위의 식별값으로 저장하며 삭제 연쇄 외래키를 만들지 않는다. V1 checksum 691030920을 유지했고 V2 checksum은 -1248664708이다. 테이블/기록/벡터를 삭제하거나 재임베딩하지 않는다.

**V2 승인 전에는 이 브랜치로 실제 DB에 연결한 애플리케이션이나 Flyway migrate를 실행하지 않는다. 시작 시 Flyway가 V2를 적용하기 때문이다.** Hibernate validate, 벡터 3072 검증, 자동 스키마 생성 끔, clean 비활성은 유지한다.

## 수행한 검증

| 검사 | 결과 |
| --- | --- |
| 일반 JUnit | 20개 실행·통과, opt-in PostgreSQL 테스트 7개는 이 실행에서 제외 |
| PostgreSQL 통합 | 7개 중 6개 실행·통과, 별도 백업 환경변수 필요 테스트 1개 제외. 실제 백업 복원은 아래 별도 절차에서 실행 |
| 마이그레이션 | 빈 DB V1+V2, 합성 기존 스키마 명시적 baseline→V2, 실제 V1→V2 업그레이드, 모든 테이블의 기존 값/시퀀스/벡터 보존, Hibernate 전체 비교/validate, 차원 불일치 거부 |
| 실제 쿼리 | Hibernate repository에서 소유자·방 제한, SYSTEM 제외, 12행/2,001자 조회 상한 확인 |
| AI 대역 | 이전 질문/답변 역할·순서와 현재 질문의 요청 포함, 한도·권한·가족 변경·아이 선택, 실패 시 무저장, 트랜잭션 완료까지 동시 요청 차단 |
| Node | 프록시 5개 + 방 응답 순서 2개, 합계 7개 통과 |
| 프론트 | 최종 TypeScript, 변경 파일 ESLint, Next production build 통과. 전체 기존 lint 오류는 별도 미해결 상태 |
| Docker | 별도 이미지 소스 빌드, 비관리자/읽기 전용 실행, V1→V2 및 JPA validate, healthy 통과 |
| HTTP | 새 상담/선택/타 가족/기존 방/입력 상한 16개, 기존 인증/일지 회귀 19개 통과 |

Docker 검증 이미지: `icare-backend:chat-context-validation`, ID `sha256:b8accd4ba3937371eece3def46e5269f7742ad8fe773e3e0a0af843e100591b0`. 이전 `icare-backend:private-test` 이미지는 보존했다. 새 검증 컨테이너는 `icare-chat-context-validation`, DB는 `icare_validation_private_20260908`이다. 내부 Docker 네트워크만 연결하여 인터넷과 실제 Gemini/메일 호출 없이 합성 계정으로 검사했다. 검증 후 컨테이너와 검증 DB 서버를 중지하고 파일·데이터는 보존했다.

실제 Gemini 답변의 정확성·대화 품질, 실사용 브라우저 전 과정, 실제 SMTP/Cloudflare/Vercel 연결은 미검증이다. 자동 테스트 통과를 이 항목의 완료로 간주하지 않는다.

## 실제 DB 백업과 적용 검수안

서비스 DB는 `parenting-postgres/parenting_db`의 기존 볼륨 그대로 실행 중이다. 마지막 읽기 전용 확인 결과 V1만 적용되어 있고 public 테이블 16개, 업무/벡터 테이블 15개의 데이터는 0행, vector(3072)였다.

적용 전 백업: `C:\Users\USER\.icare\backups\20260908-before-v2\database.dump`, 33,298바이트, SHA-256 `B640DD26E2656313C7C46ABC1BD0A0551AAFDAA799DDBEA0FF1E5C09B0CAC68A`.

이 백업을 `icare_validation_before_v2_real`에 복원하여 V1 이력/스키마/빈 데이터/벡터 차원을 확인했다. 이 **격리 복원본에만** V2를 적용한 뒤 3개 새 컬럼, V1/V2 이력, 동일 테이블·기존 데이터·벡터를 재확인했다. `restore-verification.json`에 증빙을 기록했다. 원래 D: PostgreSQL 파일의 CRC 오류 복구와 별개이며 같은 PC의 백업이 디스크 장애 대비 외부 사본을 대신하지 않는다.

승인 후 실제 적용 순서:

1. 실제 백엔드를 중지한 상태에서 DB 대상·볼륨·이력·새 쓰기 여부를 재확인한다. 상태가 달라졌으면 새 백업/격리 복원부터 수행한다.
2. 외부 보안 파일에서 DB 설정을 읽어 `scripts/db/Invoke-Flyway.ps1 -Action migrate -VectorDimensions 3072`, 이어서 validate를 실행한다. baseline은 다시 실행하지 않는다.
3. 이력/V1 checksum/추가 컬럼/기존 데이터와 벡터를 비교하고 적용 후 백업도 복원 검증한다. 실제 계정·지식 초기화와 외부 배포는 하지 않는다.
4. 실제 Gemini/SMTP 설정과 실행 승인이 준비되면 [2단계 실행 안내](PRIVATE_BACKEND_RUNBOOK.md)의 backend-only Compose를 사용한다. 검증 이미지 태그와 서비스 이미지 태그를 혼동하지 않는다.

문제 발생 시 백엔드만 중지한다. V2는 컬럼 추가뿐이므로 우선 2단계 이미지로 코드 복귀하는 안을 복원본에서 검증한다(2단계 코드는 V2를 사용하지 않지만 구버전 시작 호환성은 이번에 별도 실행하지 않음). 추가 컬럼/기록은 보존하고 Flyway 이력 삭제나 DROP COLUMN/clean을 실행하지 않는다. 실제 복원이 필요하면 백업을 새 격리 DB에 복원하여 확인한 뒤 별도 승인으로 전환한다. 백업 이후 생긴 기록을 먼저 별도 보존하여 복원으로 소실되지 않게 한다.

## 다시 검사하는 방법

일반 테스트는 backend 폴더에서 `mvnw.cmd test`, frontend 폴더에서 `node --experimental-strip-types --test tests/*.test.mjs`, `npx.cmd tsc --noEmit`, `npm.cmd run build`로 실행한다. DB 통합 테스트는 [Flyway 작업서](FLYWAY_RUNBOOK.md)의 격리 ICARE_TEST_* 설정이 필요하다.

검증 전용 DB와 새 백엔드를 시작한 뒤 `scripts/Test-PrivateBackend.ps1 -Mode context -Container icare-chat-context-validation` 및 `-Mode verify`로 HTTP를 검사한다. 스크립트는 검증 라벨·DB 이름·외부 차단 네트워크를 검사한다. context 검사는 합성 계정/아기와 `legacy-context-smoke` 방 fixture가 필요하고 새 테스트 방을 추가한다. 서비스 DB에 fixture를 만들지 않는다.

4단계 문서 형식/버전/출처 개선은 미착수이며 `feat/knowledge-ingestion` 브랜치 제안도 아직 승인받지 않았다.
