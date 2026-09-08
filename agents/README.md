# iCare 프로젝트 분석 문서

분석일: 2026-09-06. 현재 작업 트리의 소스와 설정을 기준으로 작성했다.

## 읽는 순서

이번 작업에는 [실행 합의](EXECUTION_PLAN.md)의 단계·승인 기준을 먼저 적용한다. 아래 기존 분석의 개선 제안은 구현 완료를 의미하지 않는다. 최신 실행 상태는 [작업 기록](WORK_LOG.md)에 기록한다.

| 문서 | 내용 |
| --- | --- |
| [EXECUTION_PLAN.md](EXECUTION_PLAN.md) | 비공개 테스트 목표, 단계별 범위, 승인 경계, 사용량 예산 |
| [WORK_LOG.md](WORK_LOG.md) | 2026-09-08 재확인 결과, 수행·미수행, 다음 작업 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 시스템 경계, 기술 구성, 핵심 요청 흐름과 데이터 관계 |
| [BACKEND.md](BACKEND.md) | API 영역, 서비스 책임, 인증·RAG·영속성 구조 |
| [FRONTEND.md](FRONTEND.md) | 페이지 구성, 상태 관리, HTTP와 인증 흐름 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 환경 설정, 실행 전제, 검증 방법과 결과 |
| [REFACTORING.md](REFACTORING.md) | 코드 근거, 우선순위, 개선 방향과 완료 조건 |

## 분석 결론

분리 배포되는 프론트엔드와 단일 Spring Boot 백엔드 구조다. 현재 규모에서는 서비스를 더 나누기보다 **권한 경계 보강 → 실패·데이터 처리 수정 → 서비스와 화면 책임 분리** 순서가 적절하다.

가장 먼저 확인할 항목은 일반 회원가입의 관리자 역할 주입 가능성, 육아 일지의 가족 소유권 검사 누락, 고정 자격증명을 이용한 관리자 자동 생성이다. 자세한 전제와 근거는 리팩토링 문서에 기록했다. 실제 계정이나 운영 데이터에 대한 재현 요청은 실행하지 않았다.

## 기존 문서와의 관계

루트 `README.md`, `PROJECT_ARCHITECTURE.md`는 기존 설명을 보존했다. 이 폴더는 현재 코드 기준의 분석 기준점이다. 상충하는 내용은 아래와 같다.

| 기존 설명 | 현재 코드에서 확인한 내용 |
| --- | --- |
| JWT 24시간 | `JwtUtil`은 2시간 |
| 로그인 응답 `{ token: ... }` | `UserController.login`은 JWT 문자열 응답 |
| 루트 레이아웃이 Header/Footer 포함 | 루트는 공통 HTML/main 래퍼이며 Header는 개별 화면에서 구성 |
| 관리자 PDF/DOCX 업로드 | 관리자 UI는 TXT/CSV/MD, 서비스는 UTF-8 텍스트 변환. 시작 시 리소스 로더에 별도 PDF/Tika 경로 존재 |
| 운영 임베딩 경량화의 설계 의도 | dev 3072/NONE, prod 768/HNSW 설정은 확인. 의도와 운영 호환성은 검증하지 않음 |
| 일지 모델 중심이 `Record` | 현재 `/api/logs`는 `DailyLog` 사용. `Record`는 별도 엔티티로 남음 |
| Compose만으로 초기 빌드 가능 | 백엔드 Dockerfile은 사전 생성한 `target/*.jar` 필요 |

문서에 사용한 버전은 저장소 선언값이며, 외부 서비스의 현재 지원 여부나 설치된 모든 패키지의 실제 버전을 검증한 것은 아니다.
