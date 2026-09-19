# 로컬 검색 기반 상담·일과표 검수

2026-09-19. 사용자 승인으로 회원가입 변경 `881d163`을 main에 fast-forward 병합하고 `feat/rag-service`에서 후속 구현했다. 이후 사용자가 요약 5개 실제 등록·무료 API 검수를 승인하여 등록과 검수를 마쳤다. 사용자의 추가 승인으로 RAG 커밋 `35ce3c6`을 main에 fast-forward 병합했다. 외부 배포·Naver Cloud 구매는 수행하지 않는다.

## 구현

Spring AI + Gemini + PostgreSQL/pgvector를 유지한다. LangChain/LangGraph로 교체하지 않는다. 등록은 원문 확인 → 추출/요약 검토 → 해시 확인 → 임베딩 → 버전과 벡터 저장 순서다. 검색은 질문 임베딩 → 현재 승인 버전·대상 월령·유사도 필터 → 제한된 발췌 → Gemini 답변 → 실제 전달 출처 표시 순서다.

- 기존 `gemini-embedding-001`, vector(3072), COSINE_DISTANCE, 인덱스 NONE을 보존한다. 추가 Flyway SQL이나 기존 벡터 재변환은 없다.
- 메타데이터에 최소/최대 만 월령(양 끝 포함), 적용 지역 KR/US/UK/GLOBAL/UNSPECIFIED를 추가했다. 월령이 있는 요청은 월령 범위가 없는 예전 자료를 제외한다. 기존 자료는 지우지 않는다. 메타데이터 변경은 새 검토 해시를 요구한다.
- 검색 최대 5개, 제목·지역·월령 헤더를 포함해 문맥 4,000자. 유사도 기본 0.45(`ICARE_RAG_MIN_SIMILARITY`, 0~1). 이는 초기 설정이며 실제 질문으로 품질 보정 전이다.
- 일과표는 `.env`의 `ICARE_DAILYLOG_SOURCE_URLS`에 지정한 수유·배변 관련 출처만 검색한다. 현재는 승인한 국내 영양·영국 의료 도움 징후 2개다. 설정이 비어 있으면 생성하지 않고 근거 부족 안내를 한다. 새 자료는 검수 후 목록에 추가한다. 일반 채팅은 5개 전체에서 검색한다.
- 채팅은 선택한 아이의 현재 월령, 일과표는 선택한 날짜 당시 월령을 사용한다. 가족 권한 검사 뒤 조회/검색한다. 미래 날짜·생일 이전 날짜·생일 미등록 분석은 거부한다.
- 일과표 검색용 질문에는 이름·가족 ID·부모 메모를 넣지 않는다. 생성 모델에는 제한된 부모 메모가 전달될 수 있으므로 실제 서비스 안내가 필요하다. 현재 키·프로필이 과거 날짜의 측정값처럼 적용되지 않도록 체중·키는 분석 입력에서 제외했다.
- 기록된 건수와 실제 하루 총량을 구분한다. 미기록을 0회/정상으로 판단하지 않는다. 근거가 없으면 생성 모델을 호출하지 않고 근거 부족 안내를 반환한다.
- 출처 번호가 없거나 범위를 벗어난 답변도 근거 부족 안내로 바꾼다. 번호 검사는 문장과 의료 근거의 의미적 일치를 증명하지 않는다. 실제 답변 근거 검수는 별도로 필요하다.
- 일과표 응답 `{result,retrievalSources,status}`에 사용한 발췌/원문/지역/월령을 포함한다. `status`는 answered/insufficient_evidence/no_records다. 일과표 분석은 현재 화면 응답이며 별도 DB 저장하지 않는다. 채팅은 기존 메시지 출처 컬럼에 저장한다.
- 화면은 AI HTML을 실행하지 않고 Markdown 텍스트로 표시한다. 일과표에서는 임의 이미지·링크를 렌더링하지 않고 검증한 출처 링크만 제공한다. 아이·날짜 변경/기록 변경 후 늦은 이전 응답은 표시하지 않는다.

## 최초 등록 검수안

문서는 코드와 별도로 Git에서 제외된 `doc/official-infant-guidance-2026-09-19/registration/draft.json`에 있다. 내려받은 12개 출처 전체를 자동 등록하지 않는다. 첫 등록은 원문을 대조한 짧은 한국어 비공식 요약 5개, 총 2,113자·5개 벡터 조각이다. 의료기관의 공식 번역/인증이나 전체 의료 검토 완료를 뜻하지 않는다.

| 주제 | 기관·지역 | 월령 | 범위 |
| --- | --- | --- | --- |
| 수유·영양 | 질병관리청·국내 | 0~11 | 모유/조제유·보충식의 일반 원칙, 개별 처방량 산출 제외 |
| 안전 수면 | NIH NICHD·미국 | 0~11 | 수면 자세·잠자리·보호자 감독, 2022년 8월 자료 |
| 발달 관찰 | CDC·미국 | 0~12 | 관찰과 상담 안내, 선별검사/진단 대체 금지 |
| 예방접종 | 질병관리청·국내 | 0~12 | 2026년 도표 확인 방법, 세부 일정 자동 계산 제외 |
| 진료 필요 징후 | UHS NHS·영국 | 0~11 | 즉시 도움을 구할 증상, 2023년 10월 자료 |

정확한 개정 일자를 모르면 빈 날짜로 저장하고 본문에 확인된 월/연도를 적는다. 월령은 이번 등록 요약의 적용 범위다. 복잡한 백신 간격표, 원본 전체, WHO 지역별 조건부 권고, 발열 온도·약 용량은 이번 5개 요약에 넣지 않았다. 공개 서비스 전 이용 조건·의료 내용·문서 갱신 정책의 추가 검토가 필요하다.

`validated-preview.jsonl`은 격리 DB에서 얻은 해시·전체 내용·조각 수를 보관한다. `reviewed:false` 상태가 사용자 승인 전 상태다. 같은 입력을 실제 대상으로 미리보기하여 currentVersion/duplicate도 재확인한 후에만 등록한다.

실제 등록 완료: `approved.json`의 5개 항목은 사용자 승인 후 reviewed=true이며, `registration.jsonl`에 생성한 버전 UUID와 결과가 있다. 원본 전체의 승인 상태와 구분한다. 읽기 쉬운 등록 원문은 같은 폴더 `README.md`다.

## 백업과 DB 변경 범위

실제 대상: `parenting-postgres/parenting_db`. 2026-09-19 12:51 UTC 기준 knowledge_revision/vector_store 모두 0행. 사용자·일지·계정은 그대로 보존한다.

백업: `C:\Users\USER\.icare\backups\20260919-before-rag-registration\database.dump` (37,649바이트).
SHA-256: `59FFCABC5FBA9B8DB246026C6A79281FBB172C6A9DF8DF3ACFC2479915FE9611`.
`icare-rag-validation`의 새 `icare_validation_20260919_rag_restore`에 복원했고 실제 DB와 17개 테이블의 전체 행 해시·행 수가 일치했다. 개인정보/비밀번호 행 내용은 출력하지 않았다. 백업 이후 사용자가 기록을 추가했다면 실행 전에 새 백업·복원 확인을 한다.

등록 SQL 동작(실제 실행 값은 준비한 요약·해시·새 UUID·Gemini 벡터):

```sql
-- 출처별 트랜잭션 잠금과 중복/현재 버전 확인 후 실행한다.
SELECT pg_advisory_xact_lock(hashtextextended(:source_url, 0));
INSERT INTO vector_store(id, content, metadata, embedding)
VALUES (:chunk_id, :reviewed_text, :source_metadata, :embedding_3072);
INSERT INTO knowledge_revision(id, source_url, title, publisher, revised_on,
                              content_hash, active, chunk_count)
VALUES (:version, :source_url, :title, :publisher, NULL, :reviewed_hash, true, 1);
```

서비스가 위 처리를 문서마다 트랜잭션으로 수행한다. 최초 등록은 5개 버전+5개 벡터 추가이며 기존 사용자·일지·대화 행 변경, DDL, 삭제가 없다. 여러 문서 중 뒤 문서가 실패하면 앞서 완료한 문서는 남고 결과 보고에 기록한다. 외부 API 요청은 DB 롤백으로 취소되지 않는다. 같은 해시는 중복 임베딩하지 않는다.

문제가 있으면 등록 결과의 UUID만 비활성화하여 새 검색에서 제외하는 복구를 검수 후 실행한다. 원본/사용자 기록을 덮어쓰지 않는다.

```sql
BEGIN;
UPDATE vector_store
SET metadata=jsonb_set(metadata::jsonb,'{icare_active}','false'::jsonb)::json
WHERE metadata->>'icare_managed'='true' AND metadata->>'icare_version' IN (:registered_versions);
UPDATE knowledge_revision SET active=false WHERE id IN (:registered_versions);
COMMIT;
```

전체 DB 복원은 최신 사용자 기록을 잃을 수 있으므로 새 격리 DB에 복원·비교한 뒤 전환을 별도 승인받는다. `clean`, DROP, 이력 삭제는 사용하지 않는다.

등록 후 백업: `C:\Users\USER\.icare\backups\20260919-after-rag-registration\database.dump` (120,638바이트), SHA-256 `0A0FECA908643154B3F2E04864C679A5B8E87C517BDF014B00D61FC22B49F6C1`.
새 `icare_validation_20260919_rag_live`에 복원하여 17개 테이블 행 해시·행 수 일치를 확인했다. 등록 전과 비교해 지식 테이블 외 15개 테이블 및 public 시퀀스 값도 동일했다. 실제 DB에는 승인된 버전/벡터 각 5행이 있으며 3072차원을 확인했다. 그 뒤 합성 API 검수 데이터는 복원본에만 생성했다.

## 실행 방법

`scripts/Invoke-KnowledgeBatch.ps1`은 외부 `.env`로 실행하는 일회성 로컬 프로세스다. 기본은 미리보기이며 임베딩/등록은 하지 않는다. 시작 시 Flyway·일반 데이터/관리자 bootstrap·다른 자동 적재를 끄고 loopback 임시 포트만 사용한 뒤 종료한다. 보고서는 덮어쓰지 않는다.

```powershell
# 먼저 미리보기. InputFile은 코드 밖 JSON 목록, OutputFile은 새 경로.
./scripts/Invoke-KnowledgeBatch.ps1 -InputFile <draft.json> -OutputFile <preview.jsonl>
# 사용자 승인 후 reviewedHash/expectedVersion을 미리보기와 대조하고 reviewed=true로 만든 목록에만 사용.
./scripts/Invoke-KnowledgeBatch.ps1 -InputFile <approved.json> -OutputFile <registration.jsonl> -Apply
```

관리자 화면에서도 동일한 검토·월령·지역 입력과 등록 경로를 사용할 수 있다. 최초 관리자나 API 키를 새로 하드코딩하지 않았다.

## 검증 상태

- 최종 백엔드 73개 중 67개 통과, 실패 0. Redis 별도 연결 검사 4개·기존 복원 fixture 1개·실제 API 검수 1개는 일반 회귀 실행에서 제외했다. 최신 백업 복원과 실제 API 검수는 위 별도 승인 실행으로 완료했다.
- 실제 pgvector 3072차원 + 합성 임베딩으로 월령 필터, 현재 버전 검색, 중복, 교체, 부분 실패 롤백, 초안 5개 미리보기/등록 경로 통과. 실제 Gemini 품질 검증으로 간주하지 않는다.
- Node 테스트 10개 통과. Playwright에서 일과표 출처/지역/미기록, 안전한 Markdown, 아이 전환 후 되돌아오기 및 날짜 변경의 응답 무효화, hydration 오류 없음 확인. 앱 API는 합성 응답으로 대체했다.
- 수정 파일 lint 오류·경고 0, Next.js production webpack 빌드·타입 검사 통과.
- 실제 AI Studio의 무료 등급과 가려진 키 뒷자리/로컬 설정 일치를 확인했다. 승인된 임베딩 5개 등록 성공. 복원본 + 합성 계정에서 실제 인증 필터/컨트롤러/서비스/Spring AI/Gemini를 사용한 채팅, 일과표, 24개월 범위 밖, 육아 외 질문을 검사했다. 안전 수면 답변은 NIH 발췌와 번호가 연결되며 미국 권고로 구분했다. 범위 밖/무관 질문은 근거 부족 안내였다.
- 최초 실제 일과표 답변에 무관한 CDC 자료가 포함되어 3개월/4개월 발달 항목을 섞은 문제를 발견했다. 검사를 통과했다는 이유로 근거 검수를 완료 처리하지 않고, 일과표 검색을 위 2개 출처로 제한했다. 후속 실제 답변에서 해당 혼합이 사라지고 미기록을 0회/정상으로 판단하지 않음을 원문 발췌와 대조했다. 보고서는 `live-report.jsonl`, `live-daily-scoped-report.jsonl`이며 합성 정보만 들어 있다.
- 실제 호출 작업은 등록 5회 + 첫 검수 최대 8회 + 수정 후 일과표 검수 2회로 승인 상한 20회 이내다. 유료 결제 활성화/무료 한도 초과 재시도는 없었다. 이는 제공자 청구서 조회나 모든 질문의 의료 정확성 보장을 의미하지 않는다.
- 실제 계정 데이터로 AI 검수를 실행하거나 메일을 발송하지 않았다. UI 검수는 합성 응답, 실제 모델 검수는 격리 백엔드 전체 경로로 구분한다. 더 넓은 문헌 범위·다양한 질문·공개 의료 서비스의 내용 검수는 후속 과제다. Naver Cloud 배포는 별도 범위로 정한다.
