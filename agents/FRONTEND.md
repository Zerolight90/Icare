# 프론트엔드 분석

3단계에서는 새 상담에 일반/아이 선택을 추가하고 이전 상담의 읽기 전용 안내, 입력 한도, 비동기 방 응답 검사를 적용했다. 전체 UI 개편 없이 `/chat` 흐름만 수정했다. 최신 API/검증은 [대화 맥락 작업서](CHAT_CONTEXT_RUNBOOK.md)를 따른다.

기준 경로: `babychatboot_frontend/chat-frontend`.

2026-09-08 2단계 변경: 브라우저 API는 같은 origin의 Next.js 서버 경로를 사용하며 기존 rewrite/NEXT_PUBLIC_API_URL 직접 연결을 제거했다. 서버 경로에서 서비스 인증을 붙이고, 이미지 읽기에 한정된 HttpOnly 쿠키를 로그인/로그아웃에 연결했다. [비공개 실행 안내](PRIVATE_BACKEND_RUNBOOK.md)를 최신 기준으로 적용한다. 아래 분석은 기존 화면/구조의 이력이다.

## 화면과 공통 구조

| 페이지 | 책임 |
| --- | --- |
| `/`, `/login`, `/signup` | 소개, 로그인, 가입·인증 |
| `/mypage`, `/babies` | 프로필·가족 합류, 아기 관리 |
| `/chat` | 방 목록, 메시지, 빠른 질문, 마크다운 |
| `/dailylog` | 날짜별 일지, 편집, CSV, 건강 문진 |
| `/community`, `/community/write`, `/community/[postId]` | 목록·작성·상세·댓글 |
| `/hospitals` | 지도·위치 기반 병원 조회 |
| `/admin/*` | 사용자·관리자·게시판·공지·AI 설정·문서·일지 관리 |

루트 `app/layout.tsx`는 메타데이터와 HTML/main 래퍼를 제공한다. 사용자 화면은 각자 Header 등을 조합하고, 관리자는 `app/admin/layout.tsx`의 사이드바를 공유한다. 주요 인터랙티브 페이지는 client component다.

## 데이터·인증 흐름

`app/lib/axios.ts`가 유일한 공통 HTTP 인스턴스를 제공한다. `NEXT_PUBLIC_API_URL`을 baseURL로 사용하며 미지정이면 상대 `/api` 요청이 Next.js rewrite를 거친다. 요청 인터셉터는 `localStorage.accessToken`을 읽는다.

응답 인터셉터는 401에서 토큰을 지우고 보호 화면이면 로그인으로 이동한다. `/chat`은 이 리다이렉트 목록에서 공개 화면으로 취급되지만, 채팅 API는 인증이 필요하다. 이 차이는 접근 경험과 안내 문구에 반영할 필요가 있다.

관리자·일반 사용자 로그인은 같은 토큰 저장 키를 쓴다. 관리자 레이아웃은 토큰 payload의 role을 읽어 화면 이동을 결정한다. 이 검사는 UI 처리이며 실제 보안 경계는 서버의 JWT 서명 검증·권한 정책이다.

## 상태 관리와 복잡도

서버 데이터, 폼 상태, 로딩, 모달, API 호출, JSX가 각 페이지의 `useState/useEffect`와 함수에 함께 있다. 공유 데이터 조회 훅이나 업무별 API 모듈은 현재 app 구조에서 확인되지 않는다.

2026-09-06 소스 줄 수:

| 파일 | 줄 수 |
| --- | ---: |
| `app/dailylog/page.tsx` | 621 |
| `app/admin/chatbot/page.tsx` | 524 |
| `app/chat/page.tsx` | 500 |
| `app/mypage/page.tsx` | 460 |
| `app/hospitals/page.tsx` | 429 |

줄 수 자체보다 서로 다른 변경 이유가 한 파일에 모여 있는 점이 분리 근거다. 예를 들어 일지 화면은 일지 편집과 건강 문진, CSV 상태를 함께 관리하고, 관리자 챗봇 화면은 설정과 대화 조회를 함께 관리한다.

## 먼저 수정할 동작

- 채팅 전송은 POST 응답을 무시한 뒤 DB 메시지를 재조회한다. 서버가 실패 안내를 200 문자열로 반환하고 저장하지 않으면 화면에서 안내가 사라진다.
- 방 변경·날짜 변경 조회에 취소 또는 요청 식별 검사가 없다. 늦게 도착한 이전 요청이 현재 화면을 덮어쓸 수 있다.
- 채팅의 `SidebarContent`가 페이지 함수 안에서 정의된다. 상태 변경 때 컴포넌트 타입이 새로 만들어지므로 새 방 입력 등 하위 상태·포커스 유지 문제를 확인하고 바깥으로 분리한다.

## 점진적 분리안

다음은 제안 구조이며 아직 생성한 애플리케이션 폴더가 아니다.

```text
app/.../page.tsx          라우트와 화면 조합
features/chat/           채팅 API, 타입, 조회 훅, 메시지·사이드바 컴포넌트
features/dailylog/       일지 API, 타입, 폼, CSV·문진 패널
features/admin/          관리자 기능별 화면 조각
lib/api/                 공통 HTTP와 오류 변환
lib/auth/                인증 상태와 토큰 처리
components/ui/           실제 반복되는 버튼·다이얼로그·빈 상태
```

첫 단계는 API와 타입, 조회 훅, 표현 컴포넌트를 분리하고 기존 동작을 유지하는 것이다. 상태 관리 라이브러리나 UI 시스템 전체 교체는 필요성이 검증된 뒤 판단한다. 프론트엔드 코드를 변경할 때는 기존 `AGENTS.md`에 따라 설치된 Next.js의 해당 가이드를 먼저 확인한다.
