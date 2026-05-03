# iCare - AI 기반 육아 상담 챗봇 서비스

> **Google Gemini + RAG 기술을 활용한 육아 전문 AI 상담 플랫폼**

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [주요 기능](#주요-기능)
3. [기술 스택](#기술-스택)
4. [시스템 아키텍처](#시스템-아키텍처)
5. [폴더 구조](#폴더-구조)
6. [데이터베이스 설계](#데이터베이스-설계)
7. [API 명세](#api-명세)
8. [시작하기](#시작하기)
9. [환경 변수 설정](#환경-변수-설정)

---

## 프로젝트 개요

**iCare**는 육아 중인 부모를 위한 AI 상담 서비스입니다.  
"따오기 선생님" 페르소나를 가진 소아과 전문 AI가 육아·아동 건강 관련 질문에만 답변하며, RAG(검색 증강 생성) 기술로 전문 문서 기반의 정확한 정보를 제공합니다.

| 항목 | 내용 |
|------|------|
| 개발 기간 | 2025 |
| 개발 인원 | 1인 |
| 배포 환경 | Docker Compose |
| 주요 목적 | 포트폴리오 |

---

## 주요 기능

### 회원 관리
- 이메일 인증 기반 회원가입 (6자리 코드, 3분 유효)
- JWT 토큰 기반 로그인/로그아웃
- 엄마/아빠 역할 구분 프로필

### 가족 그룹
- 가족 생성 및 6자리 초대코드 발급
- 초대코드로 배우자 가족 합류
- 아기 프로필 공유 (이름, 성별, 생년월일)

### AI 상담 채팅
- Google Gemini 2.5 Flash Lite 기반 AI 응답
- RAG: 전문 문서(PDF, DOCX 등)를 pgvector로 임베딩 후 유사도 검색
- 육아·아동 건강 외 주제 답변 거부 (엄격한 시스템 프롬프트)
- 채팅방 다중 생성 및 대화 기록 영구 저장
- 퀵리플라이 카테고리 버튼으로 빠른 질문 입력

### UI/UX
- 반응형 레이아웃 (데스크톱: 사이드바, 모바일: 드로어)
- AI 응답 마크다운 렌더링
- 타이핑 중 로딩 인디케이터 및 자동 스크롤

---

## 기술 스택

### Backend
| 분류 | 기술 |
|------|------|
| Language | Java 17 |
| Framework | Spring Boot 3.5.13 |
| ORM | Spring Data JPA |
| Security | Spring Security + JJWT 0.12.3 |
| AI | Spring AI 1.1.5 (Google Gemini) |
| Vector DB | pgvector (PostgreSQL 확장) |
| Email | Spring Mail (Gmail SMTP) |
| Build | Maven |

### Frontend
| 분류 | 기술 |
|------|------|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 |
| UI Library | Material-UI (MUI) 7.3.9 |
| Styling | Tailwind CSS 4.0 |
| HTTP Client | Axios 1.15.0 |
| Markdown | React Markdown 10.1.0 |

### Infrastructure
| 분류 | 기술 |
|------|------|
| Database | PostgreSQL + pgvector |
| Container | Docker / Docker Compose |
| Auth | JWT (24시간 만료) |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│                    Next.js (localhost:3000)                  │
│         Landing  /  Login  /  Signup  /  Chat               │
└─────────────────────────┬───────────────────────────────────┘
                          │  HTTP (Axios + JWT)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Spring Boot Backend                        │
│                    (localhost:8080)                          │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │UserController│  │ChatController│  │CategoryController │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                │                     │            │
│  ┌──────▼──────┐  ┌──────▼───────┐             │            │
│  │ UserService │  │GeminiService │             │            │
│  │  (JWT, BCrypt│  │  (RAG + AI)  │             │            │
│  │  Email Verify│  └──────┬───────┘             │            │
│  └─────────────┘         │                     │            │
│                    ┌─────▼──────────────────────▼────────┐  │
│                    │         Spring Data JPA              │  │
│                    └─────────────────────┬───────────────┘  │
└──────────────────────────────────────────┼──────────────────┘
                                           │
              ┌────────────────────────────┼────────────────┐
              │                            │                │
              ▼                            ▼                ▼
    ┌──────────────────┐     ┌─────────────────────┐  ┌──────────────┐
    │    PostgreSQL     │     │  pgvector Store      │  │  Google      │
    │  (Users, Chat,    │     │  (Document Embeddings│  │  Gemini API  │
    │   Family, Baby)   │     │   RAG Knowledge Base)│  │  (외부 API)  │
    └──────────────────┘     └─────────────────────┘  └──────────────┘
```

### RAG (검색 증강 생성) 흐름

```
[문서 로딩] documents/ 폴더 → KnowledgeLoaderService
    ↓ 텍스트 분할 (512 토큰 청크)
    ↓ Gemini Embedding API
    ↓ pgvector 저장 (3072차원, COSINE_DISTANCE)

[채팅 요청] 사용자 메시지
    ↓ 벡터 유사도 검색 (pgvector)
    ↓ 관련 문서 청크 추출
    ↓ 시스템 프롬프트 + 문서 컨텍스트 + 사용자 메시지
    ↓ Gemini 2.5 Flash Lite
    ↓ AI 답변 반환 및 DB 저장
```

---

## 폴더 구조

```
babychatboot/
├── docker-compose.yml                        # 전체 서비스 오케스트레이션
├── .gitignore
├── mysql_data/                               # (미사용, 초기 설계 흔적)
├── postgres_data/                            # PostgreSQL 데이터 볼륨
│
├── babychatboot_backend/
│   └── parenting/
│       ├── pom.xml
│       ├── Dockerfile
│       └── src/main/
│           ├── java/com/chatbot/parenting/
│           │   ├── ParentingApplication.java
│           │   │
│           │   ├── config/
│           │   │   ├── SecurityConfig.java           # Spring Security + CORS
│           │   │   ├── JwtAuthenticationFilter.java  # JWT 검증 필터
│           │   │   └── RagConfig.java                # ChatClient Bean 설정
│           │   │
│           │   ├── controller/
│           │   │   ├── UserController.java           # 회원가입, 로그인, 이메일 인증
│           │   │   ├── ChatController.java           # 채팅방 CRUD, 메시지 전송
│           │   │   └── CategoryController.java       # 퀵리플라이 카테고리
│           │   │
│           │   ├── domain/
│           │   │   ├── User.java                     # 사용자 엔티티 (이메일 인증 포함)
│           │   │   ├── Family.java                   # 가족 그룹 (초대코드)
│           │   │   ├── Baby.java                     # 아기 프로필
│           │   │   ├── ChatRoom.java                 # 채팅방 (UUID PK)
│           │   │   ├── ChatMessage.java              # 채팅 메시지 (USER/ASSISTANT)
│           │   │   ├── Record.java                   # 육아 기록 (수유/기저귀/수면)
│           │   │   └── Category.java                 # 퀵리플라이 카테고리
│           │   │
│           │   ├── dto/
│           │   │   ├── SignupRequestDto.java          # 회원가입 요청 DTO
│           │   │   └── LoginRequestDto.java          # 로그인 요청 DTO
│           │   │
│           │   ├── repository/
│           │   │   ├── UserRepository.java
│           │   │   ├── FamilyRepository.java
│           │   │   ├── BabyRepository.java
│           │   │   ├── ChatRoomRepository.java
│           │   │   ├── ChatMessageRepository.java
│           │   │   └── CategoryRepository.java
│           │   │
│           │   ├── service/
│           │   │   ├── UserService.java              # 회원가입/로그인 로직, JWT 발급
│           │   │   ├── GeminiService.java            # RAG + Gemini AI 응답
│           │   │   ├── EmailService.java             # Gmail SMTP 인증 메일 발송
│           │   │   └── KnowledgeLoaderService.java   # 문서 임베딩 및 pgvector 저장
│           │   │
│           │   └── util/
│           │       └── JwtUtil.java                  # JWT 생성/검증 유틸
│           │
│           └── resources/
│               ├── application.yml                   # 기본 설정 (dev + secret 프로파일)
│               ├── application-dev.yml               # 개발 환경 DB/AI 설정
│               ├── application-prod.yml              # 운영 환경 (환경변수 기반)
│               ├── application-secret.yml            # 시크릿 (git 제외)
│               └── documents/                        # RAG 지식 베이스 문서 폴더
│                   └── (PDF, DOCX, TXT, PPTX 등)
│
└── babychatboot_frontend/
    └── chat-frontend/
        ├── package.json
        ├── next.config.ts                            # API 프록시 설정
        ├── tsconfig.json
        ├── tailwind.config.js
        ├── .env.local                                # 환경변수 (git 제외)
        ├── Dockerfile
        └── app/
            ├── layout.tsx                            # 루트 레이아웃 (Header + Footer)
            ├── page.tsx                              # 랜딩 페이지
            │
            ├── login/
            │   └── page.tsx                          # 로그인 페이지
            │
            ├── signup/
            │   └── page.tsx                          # 회원가입 (3단계 멀티스텝)
            │
            ├── chat/
            │   └── page.tsx                          # 메인 채팅 인터페이스
            │
            ├── components/
            │   ├── Header.tsx                        # 상단 네비게이션 바
            │   └── QuickReplies.tsx                  # 퀵리플라이 카테고리 버튼
            │
            └── lib/
                └── axios.ts                          # Axios 인스턴스 (JWT 인터셉터)
```

---

## 데이터베이스 설계

### ERD 구조

```
families (가족 그룹)
├── id (PK)
├── invite_code (UNIQUE, 6자리)
└── created_at

users (사용자)
├── id (PK)
├── email (UNIQUE)
├── password (BCrypt)
├── provider
├── name
├── nickname
├── role (MOM / DAD)
├── birth_date
├── phone_number
├── address
├── verification_code (6자리)
├── verification_expiry (3분)
├── verified (boolean)
├── family_id (FK → families)
└── created_at

babies (아기 프로필)
├── id (PK)
├── name
├── gender (M / F / U)
├── birth_date
├── family_id (FK → families)
└── created_at

chat_rooms (채팅방)
├── id (UUID, PK)
├── title
├── is_active
├── user_id (FK → users)
└── created_at

chat_messages (채팅 메시지)
├── id (PK)
├── role (USER / ASSISTANT / SYSTEM)
├── content (TEXT)
├── token_count
├── chat_room_id (FK → chat_rooms)
└── created_at

records (육아 기록)
├── id (PK)
├── record_type (수유 / 기저귀 / 수면 등)
├── amount
├── memo
├── record_time
├── baby_id (FK → babies)
├── user_id (FK → users)
└── created_at

categories (퀵리플라이 카테고리)
├── id (PK)
├── name
├── icon
└── display_order
```

### pgvector (RAG 임베딩)

- 확장: `pgvector`
- 차원: `3072` (Gemini Embedding 모델 기준)
- 거리 함수: `COSINE_DISTANCE`
- 프로덕션 인덱스: HNSW (768차원)

---

## API 명세

### 사용자 API (`/api/users`)

| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| POST | `/api/users/signup` | 불필요 | 회원가입 |
| POST | `/api/users/send-email` | 불필요 | 이메일 인증코드 발송 |
| POST | `/api/users/verify` | 불필요 | 이메일 인증코드 확인 |
| POST | `/api/users/login` | 불필요 | 로그인 (JWT 반환) |
| GET | `/api/users/me` | **필요** | 내 정보 조회 |

### 채팅 API (`/api/chat`)

| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| GET | `/api/chat/rooms` | **필요** | 채팅방 목록 조회 |
| POST | `/api/chat/rooms` | **필요** | 채팅방 생성 |
| GET | `/api/chat/rooms/{roomId}/messages` | **필요** | 채팅 기록 조회 |
| POST | `/api/chat/message` | **필요** | 메시지 전송 (AI 응답 포함) |
| DELETE | `/api/chat/rooms/{roomId}/messages` | **필요** | 채팅 기록 삭제 |

### 카테고리 API (`/api/categories`)

| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| GET | `/api/categories` | 불필요 | 퀵리플라이 카테고리 목록 |

### 인증 방식

```
Authorization: Bearer {JWT_TOKEN}
```

---

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Google Gemini API Key
- Gmail 계정 (SMTP 앱 비밀번호)

### Docker Compose로 실행

```bash
# 1. 저장소 클론
git clone <repo-url>
cd babychatboot

# 2. 시크릿 파일 생성
# babychatboot_backend/parenting/src/main/resources/application-secret.yml 생성 (아래 참고)

# 3. 전체 서비스 실행
docker-compose up -d

# 4. 접속
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
```

### 로컬 개발 환경

```bash
# Backend (Java 17 + Maven 필요)
cd babychatboot_backend/parenting
./mvnw spring-boot:run

# Frontend (Node.js 18+ 필요)
cd babychatboot_frontend/chat-frontend
npm install
npm run dev
```

---

## 환경 변수 설정

### Backend: `application-secret.yml`

```yaml
jwt:
  secret: your-jwt-secret-key-here

spring:
  ai:
    google:
      gemini:
        api-key: YOUR_GEMINI_API_KEY

  mail:
    username: your-gmail@gmail.com
    password: your-gmail-app-password
```

### Frontend: `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## 보안 고려사항

- `application-secret.yml` 및 `.env.local`은 `.gitignore`에 포함되어 있습니다.
- JWT 시크릿 키는 충분히 긴 무작위 문자열을 사용하세요.
- Gmail SMTP는 앱 비밀번호(2FA 활성화 후 발급)를 사용하세요.
- 운영 환경에서는 `application-prod.yml`의 환경변수를 사용하세요.
