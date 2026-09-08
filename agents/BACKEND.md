# 백엔드 분석

소스 기준 경로: `babychatboot_backend/parenting/src/main/java/com/chatbot/parenting`.

2026-09-08 2단계 변경: [비공개 실행 안내](PRIVATE_BACKEND_RUNBOOK.md)의 현황을 우선한다. 허용 이메일/계정 종류/관리자 활성 상태를 요청마다 확인하고, FamilyAccessService로 일지·아기 가족 권한을 검증한다. 일반 API도 사용자 인증을 요구하며 서비스 헤더 확인이 선행한다. 고정 관리자 생성은 제거했고 별도 bootstrap은 기본 비활성이다. AI 입력/검색 문맥/출력/빈도 제한과 공통 예외 처리를 추가했다. 아래 표와 개선 제안은 2026-09-06 분석 이력이다.

## 계층과 책임

| 구성 | 현재 책임 | 경계상 특징 |
| --- | --- | --- |
| `UserService` | 가입, 인증 확인, 로그인, 프로필, 비밀번호, 가족 합류 | 인증과 가족 생성 책임 혼합 |
| `GeminiService` | 방 CRUD, 소유권 확인, 메시지 저장, RAG, 건강 문진 | 외부 모델 호출과 DB 트랜잭션 결합 |
| `DailyLogService` | 날짜/기간 조회, 일지 CRUD, DTO 변환 | 호출자의 가족 권한 검증 없음 |
| `CommunityService` | 게시판, 게시글, 댓글, 작성자 확인 | 목록 페이징과 게시글 소프트 삭제 |
| `AdminService` | 관리자 인증·계정, 사용자, 게시판, 공지, AI 설정·적재, 채팅·일지 조회 | 여러 업무 영역을 한 클래스에서 처리 |
| `KnowledgeLoaderService` | 시작 시 리소스 문서 적재 | 외부 임베딩 가용성에 시작 과정이 의존 |
| `EmailService` | 코드 생성과 메일 전송 | 저장·발송 조율은 UserController에 존재 |

`BabyController`는 리포지토리를 직접 호출한다. `DailyLogController`는 CSV 생성과 건강 문진 집계·프롬프트도 담당한다. `HospitalController`는 Kakao HTTP 호출을, `FileUploadController`는 파일 저장과 읽기를 직접 수행한다. 따라서 Controller → Service → Repository 구조가 전 영역에 일관되게 적용된 상태는 아니다.

## API 지도

경로는 Controller annotation을 기준으로 정리했다. 아래 인증은 필터의 접근 수준이며, 개별 데이터 소유권을 보장한다는 뜻은 아니다.

| 기본 경로 | 주요 하위 경로 / 동작 | 접근 수준 |
| --- | --- | --- |
| `/api/users` | POST signup, send-email, verify, login | 공개 |
| `/api/users` | GET me/profile, PUT profile/password, POST family/join | 인증 |
| `/api/babies` | GET/POST 기본 경로, PUT/DELETE `{id}` | 인증; 수정·삭제는 가족 확인 |
| `/api/chat` | GET/POST rooms, GET/DELETE rooms/{roomId}/messages, POST message | 인증; 방 소유자 확인 |
| `/api/logs` | GET `{babyId}`, range/export, POST health-check/일지, PUT/DELETE entry/{logId} | 인증; 가족 확인 누락 |
| `/api/community` | boards, boards/{boardId}/posts, posts/{postId}, comments | GET 공개, 쓰기 인증; 수정·삭제 작성자 확인 |
| `/api/categories` | GET 기본 경로 | 공개 |
| `/api/notices` | GET 기본 경로 | 공개 |
| `/api/hospitals` | GET 기본 경로; 좌표·검색어 | 공개 |
| `/api/upload` | POST 이미지 / GET `{filename}` | 쓰기 인증, 읽기 공개 |
| `/api/admin/auth/login` | POST 관리자 로그인 | 공개 |
| `/api/admin` | stats, users, admins, posts, boards, notices | ADMIN |
| `/api/admin` | chatbot/configs, knowledge, knowledge/upload, chats, dailylogs | ADMIN |

로그인과 채팅 답변은 문자열, 다른 일부 응답은 DTO/Map/JPA 엔티티/Page다. 에러는 컨트롤러별 try/catch와 상태 코드로 처리하며 전역 예외 처리기는 현재 소스에서 확인되지 않는다.

## 인증 경계

`SecurityConfig`는 stateless 세션, JWT 필터, CORS를 설정한다. 보호 API에 토큰이 없거나 유효하지 않으면 401이며 관리자 API는 `ROLE_ADMIN`을 요구한다. CORS 허용 origin은 로컬 주소 두 개로 고정되어 있다.

필터는 토큰 검증 뒤 DB의 사용자·관리자 존재 여부나 활성 상태를 재확인하지 않는다. `AdminService.login`에서 활성 상태를 검사해도 이미 발급된 토큰은 비활성화 직후 무효화되지 않는다. 비밀번호 변경도 기존 토큰을 폐기하지 않는다. 만료 시간은 2시간이다.

`@AuthenticationPrincipal`은 String과 Object 타입이 혼용되고 이메일 추출 코드가 여러 컨트롤러에 반복된다. 사용자 ID·계정 종류·권한을 담은 명확한 principal로 정리하면 정책 적용 지점을 좁힐 수 있다.

## 데이터와 조회

- User/Family/Baby는 가족 공유 모델이다. 일지 권한도 작성자 하나가 아니라 가족 정책으로 결정하는 것이 현재 기능과 일치한다.
- ChatRoom은 UUID 문자열 ID, ChatMessage는 별도 ID와 `room_id` 참조를 사용한다. 두 엔티티의 관계 필드는 `@JsonIgnore` 처리되어 있다.
- DailyLog는 분유량, 모유 여부, 기저귀 유형, 메모, 기록시각을 보관한다. `Record`와 같은 모델로 취급하지 않는다.
- 게시글은 소프트 삭제·복원, 댓글은 삭제이며 댓글 수/조회 수는 엔티티 변경으로 갱신한다. 동시 변경 시 정확성은 추가 검증 대상이다.
- 관리자 채팅 검색은 방마다 메시지 count 쿼리를 호출한다. 다른 LAZY 관계 조회의 추가 쿼리 여부는 SQL 측정이 필요하다.
- 사용자·아기·게시판 삭제는 연관 데이터가 존재할 때의 처리 정책을 확인해야 한다. 운영 FK 상태와 데이터 보존 요구는 조사하지 않았다.

## 권장 책임 분리

우선 `FamilyAccessService`로 공통 접근 검증을 만들고, `BabyService`, `HealthCheckService`, `CsvExportService`로 컨트롤러의 업무 처리를 옮긴다. 이후 `ChatService`와 모델 호출 어댑터를 분리하고 관리자 기능은 인증/콘텐츠/지식 관리 단위로 나눈다. 타입이 명확한 요청·응답 DTO와 공통 오류 형식은 이 과정에서 점진적으로 적용한다.

전체 패키지를 일괄 이동하거나 마이크로서비스로 바꾸기보다 [검토 목록](REFACTORING.md)의 위험 항목을 먼저 해결한다.
