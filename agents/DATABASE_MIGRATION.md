# DB 보존·Flyway 전환 작업서

현재 단계: **원본 읽기 오류로 중단. 복구 가능한 백업과 마이그레이션 SQL은 아직 없음.**

## 2026-09-08 확인 결과

사용자가 `D:\work\babychatboot\postgres_data`를 최신 DB 원본으로 확인했다. `PG_VERSION`은 16이다. 파일 구조만 확인했으며 테이블 내용과 스키마를 조회하지 못했다.

Docker Desktop은 Model Runner의 `dockerInference` 임시 소켓 오류로 종료되고 있었다. 공식 CLI `docker desktop disable model-runner` 실행 후 엔진이 응답했다. 로컬 모델 실행 기능은 비활성화 상태이며 외부 Gemini API 설정은 변경하지 않았다. 향후 기능 재활성화는 임시 소켓 문제 해결 후 별도로 검토한다.

확인한 Docker 컨텍스트는 `desktop-linux`, 서버 버전은 28.4.0이다. 복구 직후 컨테이너·이미지·볼륨은 0개였으며 기본 네트워크만 있었다. 기존 서비스 DB 컨테이너를 찾지 못했으며 새 서비스 DB도 생성하지 않았다.

격리 검증용 `pgvector/pgvector:pg16` 이미지만 다운로드했다. 확인 digest는 `sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b`이다. 컨테이너 실행·복원은 하지 않았다.

## 백업 실패와 저장장치 상태

오프라인 백업의 원본 해시 계산 중 `postgres_data\base\4\2704`(40,960바이트)에서 Windows CRC 읽기 오류가 발생했다. 계획했던 `D:\work\icare-backups\20260908-before-flyway` 폴더는 생성되지 않았다. **성공한 백업, 부분 복사본 또는 복원 검증 결과가 있는 것으로 취급하지 않는다.**

같은 시각(20:46~20:47 KST) Windows System 로그의 `disk`, Event ID 7에 `\Device\Harddisk0\DR0` 잘못된 블록 오류가 반복 기록되었다. 파티션 조회에서 D:는 Disk 0, C:는 Disk 2다. D: 장치의 일반 HealthStatus는 Healthy였으나 실제 CRC 및 bad-block 오류도 확인되므로 이 일반 상태를 읽기 무결성 증거로 쓰지 않는다.

원본 전체 재읽기, 원본을 마운트한 PostgreSQL 시작, Flyway baseline/migrate, 디스크 수리, 파일 삭제, Docker 초기화는 수행하지 않았다. 자료 복구 방향이 정해질 때까지 같은 파일의 반복 읽기·전체 검사를 진행하지 않는다. 처음 계획한 D: 내 다른 폴더는 같은 물리 디스크이므로 별도 장애 대비 백업 위치로 적절하지 않다.

다른 디스크의 백업 또는 기존 AWS DB 보존 여부를 사용자에게 확인 요청했다. 접근 가능한 백업이 있으면 그 사본으로 다음 검증을 진행한다. 새 원본 읽기/저장장치 복구 작업은 보존 방안부터 정하고 진행한다.

## 안전한 백업 도구

[Backup-OfflinePostgres.ps1](../scripts/db/Backup-OfflinePostgres.ps1)은 중지된 파일 클러스터를 새 디렉터리에 복사하고 원본·사본의 SHA-256을 비교한다. 기존 출력 디렉터리 덮어쓰기, Git 저장소 내부 출력, `postmaster.pid`가 있는 원본, 링크/별도 tablespace를 거부한다. `PG_VERSION`과 `global/pg_control`의 존재 검사는 최소한의 경로 검사이며 PostgreSQL 내부 무결성 검사가 아니다.

모든 원본 해시를 얻기 전에 복사 디렉터리를 생성하지 않는다. 오류가 나면 완료로 표시하지 않는다. 복사 완료 시에도 `RestoreVerification=pending`이며 실제 DB 복원 검증을 대신하지 않는다. 파일을 일부만 복사하거나 읽기 오류를 무시하는 옵션은 제공하지 않는다.

현재 손상 의심 원본에 이 도구를 바로 재실행하지 않는다. 정상 읽기가 가능한 중지된 원본과 **다른 물리 디스크의 Git 외부 경로**를 확보한 후 명시적으로 두 경로를 지정한다. 복사 중 다른 프로세스가 DB를 시작하면 안 된다. 테스트 도구는 합성 파일로만 실행한다.

## 백업 확보 후의 검증 순서 — 아직 미실행

1. 원본/백업의 출처·시점·DB 버전·확장 버전을 기록한다. 최신성이 확인되지 않은 AWS DB나 과거 백업을 현재 원본으로 간주하지 않는다.
2. 검증용 볼륨·컨테이너·네트워크에만 백업 복사본을 복원한다. 백업 자체는 읽기 전용으로 보관한다. 포트가 필요하면 loopback에만 게시하고 서비스 DB를 중복 생성하지 않는다.
3. 복원 DB에서 논리 백업(`pg_dump` custom format), 스키마, 필요한 역할/권한 정보를 별도 보관한다. 역할 비밀번호 등 인증 자료는 Git·도구 출력에 노출하지 않는다. 논리 백업을 또 다른 빈 검증 DB에 복원해 실사용 가능성을 확인한다.
4. 14개 JPA 엔티티와 실제 테이블·컬럼·타입·NULL·키·시퀀스·기본값을 비교한다. `Record` 테이블과 오래된 컬럼도 임의 삭제하지 않는다. `ChatRoom`의 실제 테이블명을 확인한다.
5. vector 확장 버전, 벡터 테이블 타입/차원/인덱스, 행 수·해시·문서 메타데이터와 임베딩 모델 근거를 기록한다. 현재 dev 3072/prod 768 설정을 실제 DB 차원으로 대신하지 않는다. 모델명은 차원만으로 추정하지 않는다.
6. 실제 스키마를 근거로 `db/migration/V1__...sql`을 작성한다. 빈 DB에 migrate 후 Hibernate validate를 통과시키고, 복원 DB는 스키마 동등성을 확인한 뒤 명시적 baseline을 검증한다. Flyway history 외 데이터·벡터·시퀀스 보존을 대조한다.
7. 전환 설정은 Hibernate validate, Spring AI 스키마 자동 생성 비활성화, Flyway clean 비활성화, baseline-on-migrate false로 고정한다. 테스트에서는 앱 초기화 runner·실제 Gemini/메일 호출을 차단한다.
8. 실제 DB에 실행할 SQL/명령, 대상 식별정보, 검증 결과, 백업 해시·복원 결과, 쓰기 중지·복구 절차를 제시하고 별도 승인받는다.

## 실제 적용·복구 승인 항목

현재 승인 요청 가능한 DB 적용안은 없다. SQL과 복구 증거가 준비될 때까지 실제 DB를 변경하지 않는다. 적용 실패 시 원본을 지우거나 백업을 덮어쓰지 않는다. 검증된 별도 복원본으로 전환하는 절차와 적용 이후 새 기록의 보존 방법을 먼저 검토한다.

Flyway 의존성은 현재 Spring Boot BOM이 관리하는 11.7.2를 후보로 확인했으나 pom.xml을 변경하지 않았다. 공식 문서에서 baseline은 지정 버전 이하 마이그레이션을 건너뛰며 스키마 동등성을 증명하는 명령이 아님을 확인했다. 따라서 비교 검증이 선행해야 한다. [Flyway baseline](https://documentation.red-gate.com/flyway/reference/commands/baseline), [baseline-on-migrate](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-on-migrate-setting).

Spring AI의 현재 공식 문서에서도 스키마 자동 생성을 명시적으로 제어한다. 구현 시에는 저장소의 Spring AI 1.1.5 API와 실제 DB를 다시 대조한다. [PGvector 공식 문서](https://docs.spring.io/spring-ai/reference/api/vectordbs/pgvector.html).
