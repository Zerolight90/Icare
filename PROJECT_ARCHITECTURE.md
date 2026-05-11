# BabyChatBoot (iCare) — 프로젝트 아키텍처 문서

> 작성일: 2026-05-11  
> 프로젝트: 육아 AI 챗봇 플랫폼 (iCare)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | BabyChatBoot (iCare) |
| 목적 | 신생아·영유아 육아 AI 상담 + 일지 관리 + 커뮤니티 통합 플랫폼 |
| 핵심 기능 | RAG 기반 AI 챗봇, 수유·기저귀 일지, 커뮤니티 게시판, 병원 검색, 관리자 대시보드 |

---

## 2. 기술 스택

### 백엔드

| 분류 | 기술 | 버전 |
|------|------|------|
| Framework | Spring Boot | 3.5.13 |
| Language | Java | 17 |
| ORM | Spring Data JPA / Hibernate | - |
| Security | Spring Security + JWT (jjwt) | 0.12.3 |
| AI / LLM | Spring AI + Google Gemini | 1.1.5 |
| Vector DB | pgvector (PostgreSQL 확장) | - |
| RAG | QuestionAnswerAdvisor (Spring AI) | - |
| Document Parsing | Spring AI PDF Reader, Apache Tika | - |
| Database | PostgreSQL | - |
| Email | Spring Mail (Gmail SMTP) | - |
| Build | Maven | - |
| Utilities | Lombok | - |

### 프론트엔드

| 분류 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 16.2.1 |
| Language | TypeScript | 5 |
| UI Components | MUI (Material UI) | 7.3.9 |
| Styling | Tailwind CSS | 4 |
| HTTP Client | Axios | 1.15.0 |
| Markdown | react-markdown | 10.1.0 |

### 외부 서비스

| 서비스 | 용도 |
|--------|------|
| Google Gemini API | LLM 답변 생성 + 텍스트 임베딩 |
| Kakao Local API | 주변 소아청소년과 병원 검색 |
| Gmail SMTP | 이메일 인증 발송 |

---

## 3. 시스템 아키텍처

```
[사용자 브라우저]
      │
      │  HTTP (JWT Bearer)
      ▼
[Next.js 16 (App Router)]  ──── Axios ────▶  [Spring Boot 3.5]
   /app/*                                           │
   /app/admin/*                                     ├── Spring Security (JWT Filter)
                                                    ├── REST Controllers
                                                    ├── Service Layer
                                                    │       ├── GeminiService (RAG + Chat)
                                                    │       ├── AdminService
                                                    │       ├── UserService
                                                    │       ├── CommunityService
                                                    │       └── DailyLogService
                                                    └── Repository Layer (JPA)
                                                            │
                                                    ┌───────┴──────────┐
                                              [PostgreSQL]        [pgvector]
                                              (일반 테이블)      (임베딩 벡터 저장)
                                                            │
                                                    [Google Gemini API]
                                                    (gemini-2.5-flash-lite)
```

### RAG 처리 흐름

```
사용자 질문
    │
    ▼
QuestionAnswerAdvisor
    │
    ├── 1. 질문 임베딩 변환 (Gemini Embedding)
    ├── 2. pgvector에서 유사 문서 검색 (topK = DB 설정값)
    ├── 3. 검색된 문서 + 질문 → Gemini에 전달
    └── 4. AI 답변 생성 → DB 저장 → 클라이언트 반환
```

---

## 4. DB 테이블 구조

### 4-1. users (회원)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 회원 ID |
| email | VARCHAR | UNIQUE, NOT NULL | 로그인 이메일 |
| password | VARCHAR | | BCrypt 해시 |
| provider | VARCHAR | | 소셜 로그인 구분 (null=일반) |
| email_verified | BOOLEAN | | 이메일 인증 여부 |
| name | VARCHAR | | 실명 |
| nickname | VARCHAR | | 닉네임 |
| role | VARCHAR | | MOM / DAD |
| birth_date | DATE | | 생년월일 |
| phone_number | VARCHAR | | 전화번호 |
| address | VARCHAR | | 주소 |
| verification_code | VARCHAR | | 이메일 인증코드 |
| code_created_at | DATETIME | | 인증코드 발급 시각 (180초 유효) |
| family_id | BIGINT | FK → families | 소속 가족 |

### 4-2. families (가족 그룹)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 가족 ID |
| invite_code | VARCHAR(6) | UNIQUE, NOT NULL | 가족 초대 코드 |
| created_at | DATETIME | | 생성일 |

### 4-3. babies (아기)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 아기 ID |
| name | VARCHAR | NOT NULL | 이름 |
| gender | CHAR(1) | | 성별 (M/F) |
| birth_date | DATE | | 생년월일 |
| weight | DECIMAL | | 체중 (kg) |
| height | DECIMAL | | 신장 (cm) |
| special_notes | TEXT | | 특이사항 |
| created_at | DATETIME | | 등록일 |
| family_id | BIGINT | FK → families | 소속 가족 |

### 4-4. chat_room (채팅방)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | VARCHAR(36) | PK (UUID) | 채팅방 ID |
| title | VARCHAR | | 채팅방 제목 |
| is_active | BOOLEAN | | 활성 여부 |
| created_at | DATETIME | | 생성일 |
| user_id | BIGINT | FK → users | 소유 회원 |

### 4-5. chat_message (채팅 메시지)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 메시지 ID |
| role | ENUM | NOT NULL | USER / ASSISTANT / SYSTEM |
| content | TEXT | NOT NULL | 메시지 내용 |
| token_count | INT | | 사용 토큰 수 |
| created_at | DATETIME | | 전송 시각 |
| chat_room_id | VARCHAR(36) | FK → chat_room | 소속 채팅방 |

### 4-6. daily_log (육아 일지)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 일지 ID |
| record_time | DATETIME | NOT NULL | 기록 시각 |
| formula_amount | INT | | 분유량 (ml) |
| breastfed | BOOLEAN | | 모유 수유 여부 |
| diaper_type | ENUM | | NONE / WET / DIRTY / BOTH |
| memo | VARCHAR | | 메모 |
| created_at | DATETIME | | 작성일 |
| baby_id | BIGINT | FK → babies | 대상 아기 |
| user_id | BIGINT | FK → users | 작성 회원 |

### 4-7. community_board (게시판)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 게시판 ID |
| name | VARCHAR | | 게시판명 |
| description | VARCHAR | | 설명 |
| display_order | INT | | 정렬 순서 |
| board_type | ENUM | | COMMUNITY / MEDICAL |
| active | BOOLEAN | | 활성 여부 |

### 4-8. community_post (게시글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 게시글 ID |
| title | VARCHAR | NOT NULL | 제목 |
| content | TEXT | | 본문 |
| image_urls | TEXT | | 이미지 URL 목록 (JSON) |
| view_count | INT | | 조회수 |
| comment_count | INT | | 댓글수 |
| status | INT | | 1=정상, 0=소프트 삭제 |
| created_at | DATETIME | | 작성일 |
| updated_at | DATETIME | | 수정일 |
| board_id | BIGINT | FK → community_board | 소속 게시판 |
| user_id | BIGINT | FK → users | 작성자 |

### 4-9. community_comment (댓글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 댓글 ID |
| content | VARCHAR(1000) | NOT NULL | 내용 |
| created_at | DATETIME | | 작성일 |
| post_id | BIGINT | FK → community_post | 소속 게시글 |
| user_id | BIGINT | FK → users | 작성자 |

### 4-10. notice (공지사항)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 공지 ID |
| title | VARCHAR | NOT NULL | 제목 |
| content | TEXT | | 본문 |
| pinned | BOOLEAN | | 상단 고정 |
| active | BOOLEAN | | 노출 여부 |
| created_at | DATETIME | | 작성일 |
| updated_at | DATETIME | | 수정일 |
| admin_id | BIGINT | FK → admin | 작성 관리자 |

### 4-11. chatbot_config (AI 설정)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 설정 ID |
| config_key | VARCHAR | UNIQUE, NOT NULL | 설정 키 |
| config_value | TEXT | | 설정 값 |
| description | VARCHAR | | 설명 |
| updated_at | DATETIME | | 수정일 |

**주요 config_key 목록:**

| config_key | 기본값 | 설명 |
|------------|--------|------|
| system_prompt | 소아과 의사 역할 프롬프트 | AI 시스템 프롬프트 |
| rag_top_k | 5 | RAG 검색 문서 수 |
| rag_chunk_size | 512 | 문서 청크 크기 (토큰) |
| rag_chunk_overlap | 64 | 청크 중복 크기 |

### 4-12. admin (관리자)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 관리자 ID |
| username | VARCHAR | UNIQUE, NOT NULL | 로그인 ID |
| password | VARCHAR | NOT NULL | BCrypt 해시 |
| name | VARCHAR | | 관리자 이름 |
| active | BOOLEAN | | 계정 활성 여부 |
| created_at | DATETIME | | 생성일 |
| last_login_at | DATETIME | | 마지막 로그인 |

### 4-13. category (상담 카테고리)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO | 카테고리 ID |
| name | VARCHAR | | 카테고리명 |
| icon | VARCHAR | | 아이콘 (이모지) |
| display_order | INT | | 정렬 순서 |

### 4-14. vector_store (pgvector — RAG 지식베이스)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| content | TEXT | 청크 텍스트 |
| metadata | JSONB | 소스 정보 등 메타데이터 |
| embedding | vector(3072) | 임베딩 벡터 (dev: 3072d, prod: 768d) |

---

## 5. API 엔드포인트 목록

### 일반 사용자 API

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/users/signup | 불필요 | 회원가입 |
| POST | /api/users/send-email | 불필요 | 인증 이메일 발송 |
| POST | /api/users/verify | 불필요 | 이메일 인증 |
| POST | /api/users/login | 불필요 | 로그인 (JWT 반환) |
| GET | /api/users/me | JWT | 내 닉네임 조회 |
| GET | /api/users/profile | JWT | 프로필 조회 |
| PUT | /api/users/profile | JWT | 프로필 수정 |
| PUT | /api/users/password | JWT | 비밀번호 변경 |
| POST | /api/users/family/join | JWT | 가족 초대코드로 합류 |
| GET | /api/babies/ | JWT | 내 가족 아기 목록 |
| POST | /api/babies/ | JWT | 아기 등록 |
| PUT | /api/babies/{id} | JWT | 아기 정보 수정 |
| DELETE | /api/babies/{id} | JWT | 아기 삭제 |
| GET | /api/chat/rooms | JWT | 내 채팅방 목록 |
| POST | /api/chat/rooms | JWT | 새 채팅방 생성 |
| GET | /api/chat/rooms/{roomId}/messages | JWT | 채팅 기록 조회 |
| POST | /api/chat/message | JWT | AI에게 메시지 전송 (RAG) |
| DELETE | /api/chat/rooms/{roomId}/messages | JWT | 채팅 기록 삭제 |
| GET | /api/logs/{babyId} | JWT | 일지 조회 (날짜) |
| GET | /api/logs/{babyId}/range | JWT | 일지 조회 (기간) |
| GET | /api/logs/{babyId}/export | JWT | 일지 CSV 내보내기 |
| POST | /api/logs/{babyId}/health-check | JWT | AI 건강 문진 |
| POST | /api/logs/{babyId} | JWT | 일지 추가 |
| PUT | /api/logs/entry/{logId} | JWT | 일지 수정 |
| DELETE | /api/logs/entry/{logId} | JWT | 일지 삭제 |
| GET | /api/community/boards | 불필요 | 게시판 목록 |
| GET | /api/community/boards/{boardId}/posts | 불필요 | 게시글 목록 (페이징) |
| GET | /api/community/posts/{postId} | 불필요 | 게시글 상세 |
| POST | /api/community/boards/{boardId}/posts | JWT | 게시글 작성 |
| PUT | /api/community/posts/{postId} | JWT | 게시글 수정 |
| DELETE | /api/community/posts/{postId} | JWT | 게시글 삭제 (소프트) |
| POST | /api/community/posts/{postId}/comments | JWT | 댓글 작성 |
| DELETE | /api/community/comments/{commentId} | JWT | 댓글 삭제 |
| GET | /api/notices/ | 불필요 | 공지사항 목록 |
| GET | /api/hospitals/ | 불필요 | 주변 병원 검색 (Kakao) |
| POST | /api/upload/ | JWT | 이미지 업로드 |
| GET | /api/upload/{filename} | 불필요 | 이미지 조회 |

### 관리자 API (/api/admin)

| Method | Path | 설명 |
|--------|------|------|
| POST | /auth/login | 관리자 로그인 |
| GET | /stats | 대시보드 통계 |
| GET | /users | 회원 목록 |
| DELETE | /users/{userId} | 회원 삭제 |
| GET | /admins | 관리자 목록 |
| POST | /admins | 관리자 추가 |
| PATCH | /admins/{adminId}/active | 관리자 활성/비활성 |
| DELETE | /admins/{adminId} | 관리자 삭제 |
| GET | /posts | 게시글 목록 |
| DELETE | /posts/{postId} | 게시글 삭제 |
| PATCH | /posts/{postId}/restore | 삭제된 게시글 복원 |
| GET | /boards | 게시판 목록 |
| POST | /boards | 게시판 추가 |
| PUT | /boards/{boardId} | 게시판 수정 |
| PATCH | /boards/{boardId}/active | 게시판 활성/비활성 |
| DELETE | /boards/{boardId} | 게시판 삭제 |
| GET | /notices | 공지사항 목록 |
| POST | /notices | 공지사항 추가 |
| PUT | /notices/{noticeId} | 공지사항 수정 |
| DELETE | /notices/{noticeId} | 공지사항 삭제 |
| PATCH | /notices/{noticeId}/active | 공지사항 활성/비활성 |
| GET | /chatbot/configs | AI 설정 목록 |
| PUT | /chatbot/configs | AI 설정 변경 |
| POST | /knowledge | 텍스트 지식 추가 |
| POST | /knowledge/upload | 문서 파일 업로드 (RAG) |
| GET | /chats | 채팅 검색 (유저/닉네임/아기이름, 기간) |
| GET | /chats/{roomId}/messages | 채팅방 메시지 조회 |
| GET | /dailylogs | 일지 목록 (필터: 기저귀, 모유, 기간, 검색어) |
| DELETE | /dailylogs/{logId} | 일지 삭제 |

---

## 6. 프론트엔드 페이지 구조

```
app/
├── page.tsx                    # 메인 홈 (랜딩)
├── login/page.tsx              # 로그인
├── signup/page.tsx             # 회원가입
├── mypage/page.tsx             # 마이페이지 (프로필 수정, 가족 초대)
├── babies/page.tsx             # 아기 관리
├── chat/page.tsx               # AI 챗봇 (데스크탑 사이드바 고정)
├── dailylog/page.tsx           # 수유·기저귀 일지
├── hospitals/page.tsx          # 주변 소아청소년과 지도 검색
├── community/
│   ├── page.tsx                # 커뮤니티 게시판 목록
│   ├── write/page.tsx          # 게시글 작성
│   └── [postId]/page.tsx       # 게시글 상세 + 댓글
├── admin/
│   ├── layout.tsx              # 어드민 공통 레이아웃 (사이드바)
│   ├── login/page.tsx          # 어드민 로그인
│   ├── page.tsx                # 어드민 대시보드
│   ├── users/page.tsx          # 회원 관리
│   ├── admins/page.tsx         # 관리자 계정 관리
│   ├── posts/page.tsx          # 게시글 관리
│   ├── boards/page.tsx         # 게시판 관리
│   ├── notices/page.tsx        # 공지사항 관리
│   ├── chatbot/page.tsx        # AI 설정 (시스템 프롬프트, RAG 슬라이더)
│   ├── documents/page.tsx      # RAG 지식베이스 관리
│   └── dailylogs/page.tsx      # 일지 관리 (필터 검색)
└── components/
    ├── Header.tsx              # 전체 상단 네비게이션
    └── QuickReplies.tsx        # 챗봇 빠른 질문 버튼
```

---

## 7. 보안 구조

### JWT 인증 흐름

```
클라이언트                     Spring Security
    │                               │
    │── POST /api/users/login ──▶  UserService.login()
    │                               │── 이메일/비밀번호 검증
    │                               │── JWT 생성 (email, role 포함)
    │◀─ { token: "..." } ─────────│
    │                               │
    │── GET /api/chat/rooms ──────▶ JwtAuthenticationFilter
    │   Authorization: Bearer xxx   │── 토큰 파싱 → email 추출
    │                               │── SecurityContext에 Principal 설정
    │                               ▼
    │                         ChatController
    │                         @AuthenticationPrincipal String email
    │◀─ [ 내 채팅방만 반환 ] ──────│
```

### 공개 / 보호 엔드포인트

| 접근 수준 | 경로 |
|-----------|------|
| 인증 불필요 | /api/users/login, /api/users/signup, /api/users/verify, /api/users/send-email |
| 인증 불필요 (읽기) | /api/community/**, /api/notices/**, /api/categories/**, /api/hospitals/**, /api/upload/** (GET) |
| JWT 필요 | 위 이외의 /api/** |
| ROLE_ADMIN 필요 | /api/admin/** |

---

## 8. RAG (Retrieval-Augmented Generation) 구조

### 지식베이스 적재

```
관리자 업로드 (PDF / DOCX / TXT)
    │
    ▼
KnowledgeLoaderService / AdminService.addKnowledge()
    │── 문서 파싱 (Spring AI PDF Reader / Apache Tika)
    │── 청크 분할 (max_tokens: DB 설정, overlap: DB 설정)
    │── Gemini Embedding 변환
    └── pgvector에 저장
```

### 질문 응답 흐름

```
사용자 질문 (askToGemini)
    │
    ▼
DB에서 설정값 조회 (chatbot_config)
    ├── system_prompt (AI 역할/제약)
    └── rag_top_k (검색 문서 수)
    │
    ▼
ChatClient.prompt()
    .system(systemPrompt)
    .user(userQuestion)
    .advisors(QuestionAnswerAdvisor [topK])
    │
    ├── pgvector 코사인 유사도 검색 → 상위 K개 문서 추출
    ├── 컨텍스트 조합 (문서 + 질문) → Gemini 전송
    └── 답변 생성 → DB 저장 → 반환
```

### 환경별 벡터 설정

| 환경 | 임베딩 차원 | 인덱스 | 거리 함수 |
|------|------------|--------|-----------|
| 개발 (dev) | 3072 | 기본 | COSINE_DISTANCE |
| 운영 (prod) | 768 | HNSW | COSINE_DISTANCE |

---

## 9. 환경 설정

### 프로파일 구조

```
application.yml              ← profiles.active: dev, includes: secret
application-dev.yml          ← 개발 DB, 로깅 ON, ddl-auto: update
application-prod.yml         ← 운영 DB (env 변수), 로깅 OFF, ddl-auto: validate
application-secret.yml       ← API 키 (git 제외)
```

### 주요 환경변수 (운영)

| 변수명 | 용도 |
|--------|------|
| PROD_DB_HOST | PostgreSQL 호스트 |
| GEMINI_API_KEY | Google Gemini API 키 |
| KAKAO_REST_API_KEY | Kakao Local API 키 |
| MAIL_USERNAME | Gmail 계정 |
| MAIL_PASSWORD | Gmail 앱 비밀번호 |

---

## 10. 주요 설계 결정 사항

| 결정 | 이유 |
|------|------|
| ChatRoom ID를 UUID(String)로 사용 | 예측 불가능한 URL로 보안 강화 |
| 게시글 소프트 삭제 (status 컬럼) | 관리자가 복원 가능하도록 |
| RAG 설정을 DB(chatbot_config)에 저장 | 재배포 없이 관리자가 실시간 조정 가능 |
| JWT Principal을 email(String)로 | UserDetails 객체 대신 단순 문자열 사용으로 경량화 |
| 채팅방 소유권 검증 (email 비교) | 다른 사용자의 채팅방 접근 차단 |
| CORS를 SecurityConfig에서 글로벌 관리 | 컨트롤러별 @CrossOrigin 제거, 중앙화 |
| dev/prod 임베딩 차원 분리 | prod에서는 경량 모델(768d)로 성능 최적화 |

---

*이 문서는 Claude Code (claude-sonnet-4-6)가 자동 생성했습니다.*
