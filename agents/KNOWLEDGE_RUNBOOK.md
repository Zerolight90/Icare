# 4단계: 문서 검색 검수·실행 안내

2026-09-19 사용자 승인 후 4단계 `edffb57`을 main에 fast-forward 병합하고 실제 서비스 DB에 V3를 적용했다. 적용 전후 새 백업을 각각 격리 복원해 보존 검증을 마쳤다. 실제 문서 등록·교체, Gemini/SMTP 호출, DNS/Vercel 변경은 하지 않았다.

## 실제 적용 완료 기록

- 대상은 기존 `parenting-postgres/parenting_db`와 기존 볼륨이다. 적용 전 다른 DB 접속이 없고 서비스 백엔드는 중지 상태임을 확인했다. 원격 push는 하지 않았다.
- Flyway migrate/validate 성공: V1 `691030920`, V2 `-1248664708` 불변, V3 `-1282563757` 성공. public 테이블 17개, 추가 출처 컬럼/text와 현재 버전 유일 인덱스를 확인했다.
- 기존 업무/벡터 15개 테이블의 0행 상태, 모든 시퀀스의 last_value/is_called, vector(3072)를 보존했다. 새 knowledge_revision도 0행이다.
- 적용 전 백업: `C:\Users\USER\.icare\backups\20260919-approved-before-v3\database.dump`, 33,512바이트, SHA-256 `C30618317C7F446BC2F0C1257E3E481F999895729989074BA608F606789A900A`.
- 적용 후 백업: `C:\Users\USER\.icare\backups\20260919-approved-after-v3\database.dump`, 35,769바이트, SHA-256 `3AF29F27BC4B7F4AAE0479B316DB39AE2746182E3DC14B8891B24A09CC90AB07`.
- 각각 새 격리 DB `icare_validation_20260919_approved_pre_v3` / `icare_validation_20260919_approved_post_v3`에 복원하여 모든 테이블 행 수·시퀀스·이력·벡터 차원·출처 컬럼을 원본과 비교했다. 해당 백업 폴더의 backup-summary.json/verified-snapshot.json에 결과를 보존했다.
- 검증 서버는 중지하고 데이터/컨테이너/백업은 유지했다. 실제 DB만 healthy로 실행 중이다. 애플리케이션 실제 실행 및 외부 서비스 연결은 다음 작업이다.

## 변경한 동작

- 관리자는 PDF/DOCX/TXT/MD/CSV 또는 입력한 텍스트의 제목·HTTPS 원문 주소·발행 기관·개정일(또는 미확인)을 입력하고 추출된 전체 내용을 미리 본다. 추출 내용 확인 후 등록할 수 있으며 기존 출처의 다른 내용은 추가 교체 확인이 필요하다. 입력을 수정하면 이전 검토 상태가 초기화된다.
- `KnowledgeController`의 `/api/admin/knowledge` 목록/등록, `/preview`, `/upload/preview`, `/upload` 모두 관리자 인증을 요구한다. 이전 AdminController의 직접 적재 경로를 제거했다. 미리보기는 임베딩 API를 호출하지 않는다.
- 같은 출처와 추출 내용·메타데이터의 SHA-256으로 중복을 판정한다. 미리보기 해시와 현재 버전이 바뀌면 다시 검토해야 한다. 보관된 과거 문서를 재전송해도 자동 재활성화하지 않는다.
- 출처별 DB 잠금과 유일 인덱스로 현재 버전을 하나만 허용한다. 새 벡터 추가, 이전 벡터의 검색 비활성화, 버전 기록을 같은 트랜잭션으로 처리한다. 실패하면 DB 변경을 롤백한다. 이미 발생한 외부 임베딩 API 비용은 롤백되지 않는다.
- `KnowledgeSearchService`는 관리 대상으로 표시된 현재 버전만 검색한다. 기존 벡터는 삭제하거나 재임베딩하지 않지만, 검토 표시가 없는 과거 벡터는 새 검색에서 제외된다. 해당 자료의 검토·재등록은 별도 승인 대상이다.
- 실제 모델 입력에 포함한 자료의 원문 URL·기관·개정일·버전·PDF 페이지·발췌를 답변과 함께 저장한다. 채팅의 “AI에 전달한 참고자료”에서 확인한다. 답변의 모든 문장이 해당 자료로 입증되었다는 뜻은 아니다. 과거 답변에는 당시 검색 근거가 없음을 구분한다.

## 추출·등록 한도와 제한

파일 2 MiB, 추출 텍스트 30,000자, PDF 100쪽, 검색 조각 최대 32개다. 조각은 최대 1,500자/200자 중첩이며 기존 `rag_chunk_size` 설정은 새 적재 경로에서 사용하지 않는다. PDF 페이지 경계를 보존한다. 검색은 최대 5개, 모델에 전달하는 검색 문맥은 합계 4,000자 이내다. 등록에는 기존 AI 호출 보호(기본 분당 5회 및 동시 요청 제한)를 적용한다.

PDFBox로 PDF 텍스트를, Apache POI로 DOCX 본문·표 텍스트를 추출한다. DOCX ZIP은 항목 수/중복/압축 해제 크기도 제한한다. TXT/MD/CSV는 엄격한 UTF-8만 허용한다. OCR, 이미지 내용, 복잡한 표 배치의 완전한 보존은 지원하지 않으며 빈 추출/암호화 문서는 거부한다. 원본 파일은 이 기능이 별도 보관하지 않으므로 검토한 원본은 운영자가 보관한다.

출처·기관·개정일은 관리자가 원문을 확인해 입력하는 정보다. HTTPS 주소 형식 검사만으로 공식 기관 여부나 의학적 정확성이 보장되지 않는다. 미래 개정일 판정은 한국 날짜를 사용한다.

시작 자동 적재는 계속 기본 비활성이다. 켜려면 `documents/approved-manifest.json`에 최대 5개의 검토된 항목을 명시해야 한다. 필드는 `file`, `title`, `sourceUrl`, `publisher`, `revisedOn`, `reviewedHash`, `expectedVersion`, `replaceApproved`다. 같은 파일·메타데이터의 미리보기 결과에서 해시/현재 버전을 받아 기록한다. 파일은 documents 바로 아래에 두며 새 출처는 빈 expectedVersion, 교체는 현재 버전과 명시적 승인이 필요하다. 제공된 `.example`은 빈 목록이며 실제 등록 승인이 아니다. 기존 문서가 있다는 이유로 다른 새 문서를 건너뛰지 않는다. 각 문서가 개별 트랜잭션이므로 여러 문서 중 뒤 항목이 실패해도 앞서 성공한 등록은 유지된다.

기존 `parenting-knowledge.txt`는 원문 URL·발행 기관·개정일과 개별 의료 권고의 근거를 재확인할 검토 대상이다. 이번에 전체 의료 내용의 타당성을 조사하거나 재작성하지 않았고 자동 등록하지 않았다. 공식 문헌 검색·DOCX 작성은 별도 작업이다.

## V3 SQL과 현재 DB

실행 SQL: [V3__knowledge_revisions_and_sources.sql](../babychatboot_backend/parenting/src/main/resources/db/migration/V3__knowledge_revisions_and_sources.sql).

새 `knowledge_revision` 테이블/출처별 현재 버전 유일 인덱스와 `chat_messages.retrieval_sources text` 컬럼만 추가한다. 기존 문서·벡터를 갱신/삭제하는 SQL은 없다. 버전 테이블은 JdbcTemplate으로 관리하며 JPA 엔티티가 아니다. 격리 검증 checksum은 V1 `691030920`, V2 `-1248664708`, V3 `-1282563757`이다.

실제 `parenting-postgres/parenting_db`는 기존 볼륨을 유지한다. 아래는 9월 19일 승인 전 V2 검수 이력이며 최신 실제 DB는 위 완료 기록의 V3다. 원래 D: PostgreSQL 파일의 CRC 오류가 복구되었다는 뜻은 아니다.

승인 전 백업: `C:\Users\USER\.icare\backups\20260919-before-v3\database.dump`, 33,512바이트. SHA-256:

`D66DF0AD36AB8570E42C48E7AF64CA14636075CC9A5BDCD70530587282914DDA`

이를 `icare_validation_20260919_before_v3`에 복원하고 **복원본에만** V3 migrate/validate를 수행했다. 17개 테이블, 새 컬럼, 기존 행/벡터 차원/이력 보존을 확인했다. 백업과 복원 기록은 Git 밖에 보관한다. 같은 PC의 C: 사본은 외부 재해 복구 백업을 대신하지 않는다.

V3 승인을 받아 실제 적용을 마쳤다. 문서 자동 적재/관리자 bootstrap은 계속 비활성이며 실제 실행은 Gemini·SMTP 등 필수 설정을 확인한 후 진행한다. 향후 추가 마이그레이션은 새 검수·승인이 필요하다.

## 적용 절차와 복구

아래 1~3은 9월 19일 완료했다. 이후 새 기록이 생기면 기존 백업으로 덮어쓰지 않으며 최신 백업과 보존 절차부터 다시 확인한다.

1. 검수된 기능 커밋을 main에 병합한다. 실제 DB 대상·볼륨·V1/V2 checksum·쓰기 발생 여부를 다시 확인하고 백엔드 쓰기를 중지한다. 상태가 달라졌으면 최신 백업과 격리 복원 검증을 새로 한다.
2. Git 밖 DB 설정으로 `ICARE_DB_URL`, `ICARE_DB_USER`, `ICARE_DB_PASSWORD`를 공급한다. `scripts/db/Invoke-Flyway.ps1 -Action migrate -VectorDimensions 3072`, 이어서 `-Action validate`를 실행한다. baseline을 다시 실행하지 않는다.
3. V1/V2 불변, V3 성공, 새 스키마와 모든 기존 행/벡터 보존을 확인한다. 적용 후 백업도 별도 DB에 복원해 검증한다. 문서 등록/교체와 관리자 초기화는 이 스키마 적용 승인에 포함하지 않는다.
4. Gemini·SMTP와 초기 계정 설정을 준비한 뒤 [비공개 실행 안내](PRIVATE_BACKEND_RUNBOOK.md)의 backend-only Compose로 실행한다. Next 서버의 `ICARE_FRONTEND_ORIGIN`에는 브라우저에서 사용하는 정확한 origin을 설정한다(운영 HTTPS, 로컬에서는 실제 loopback 주소/포트). Cloudflare/Vercel 값은 서버에서만 사용한다.

문제 발생 시 백엔드를 중지하고 DB/버전 이력을 보존한다. clean, Flyway 이력 삭제, DROP/벡터 삭제로 되돌리지 않는다. **문서 교체 후 3단계 이미지로 단순 복귀하면 과거 코드가 현재 버전 필터를 사용하지 않아 보관된 문서도 검색할 수 있다.** 현재 버전 필터를 유지하는 수정이 우선이다. DB 복원이 필요하면 백업을 새 격리 DB에 복원해 검증하고, 백업 이후 생긴 기록을 별도 보존한 뒤 전환 승인을 받는다. 구버전 이미지와 V3 스키마의 실제 시작 호환성은 미검증이다.

## 검증과 미검증

| 검사 | 결과 |
| --- | --- |
| 9월 19일 JUnit | 35개 중 34개 통과, 별도 환경변수가 필요한 백업 테스트 1개 제외. 실제 백업 복원은 위 별도 절차로 검증 |
| 실제 PostgreSQL + 임베딩 대역 | 빈 DB/명시적 baseline/V2→V3, 데이터·벡터 보존, 중복/승인/교체/부분 실패 롤백, 현재 버전 검색, 자동 적재의 문서별 중복 처리 통과 |
| Node | 프록시·방 응답 순서·출처 파싱 9개 통과 |
| 프론트 | 변경 파일 lint와 Next production build/타입 검사 통과. 전체 lint는 기존 오류 6개/경고 10개로 실패 |
| Docker | 최종 소스 빌드, 읽기 전용/비관리자 실행, Flyway/JPA validate와 healthy 통과 |
| 최종 HTTP | 문서 13개 + 대화 16개 + 인증·일지 19개, 합계 48개 통과. 외부 통신 없는 격리 DB/합성 계정 사용 |
| 9월 13일 로컬 브라우저 | 관리자 로그인, 텍스트 미리보기, 검토/교체 확인에 따른 등록 버튼 제어, 입력 변경 시 검토 취소, 로그아웃 확인. 실제 등록 버튼은 실행하지 않음 |

최종 이미지 `icare-backend:knowledge-validation-final`, ID `sha256:5d0ec25f4c4ccddad0add59627b1aa91fdea9a579661665c65d0b08bc319b89a`.

브라우저의 loopback 주소와 Next 내부 요청 주소 차이로 정상 로그인이 거절되던 문제를 수정했다. 명시한 공개 origin만 허용하며 외부 origin/교차 사이트 요청 거부는 유지하고 테스트했다. 클라이언트의 forwarded-host를 신뢰하지 않는다. 예제는 [Vercel 서버 설정](../config/vercel-server.env.example)을 따른다.

실제 Gemini 답변/임베딩 품질·API 과금 설정, SMTP 인증 메일, Cloudflare Access/Tunnel·Vercel 실연결, 실제 PDF/DOCX의 브라우저 업로드와 답변 출처 전체 흐름은 미검증이다. PDF/DOCX 추출 자체와 multipart 텍스트 업로드는 자동 검사했다. 검사 통과를 의료 정보의 정확성 검증으로 간주하지 않는다.

재검사는 격리 ICARE_TEST_* 환경에서 backend `mvnw.cmd test`, frontend `node --experimental-strip-types --test tests/*.test.mjs` 및 `npm.cmd run build`로 한다. 검증 전용 백엔드/합성 fixture 준비 후 `scripts/Test-PrivateBackend.ps1 -Mode knowledge -Container icare-knowledge-final-validation`과 context/verify 모드를 실행한다. 실제 서비스 DB에 fixture를 만들지 않는다.

기술 참고: [Spring AI PgVector](https://docs.spring.io/spring-ai/reference/api/vectordbs/pgvector.html), [PDFBox 3](https://pdfbox.apache.org/3.0/migration.html), [Apache POI XWPF](https://poi.apache.org/apidocs/dev/org/apache/poi/xwpf/usermodel/XWPFDocument.html).
