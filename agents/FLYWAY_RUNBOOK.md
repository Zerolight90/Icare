# Flyway 구현·검증·적용안

현재 상태: **구현·격리 검증 완료. main 병합과 실제 DB 초기화는 승인 대기.**

## 변경된 전제와 대상

CRC 중단 이후 사용자는 Docker에서 DB 실행을 시도했고 데이터가 거의 없으므로 Flyway 작업을 계속 요청했다. `tender_feistel`은 비밀번호 누락으로 초기화 전에 종료됐다. 읽기 전용 검사에서 마운트 볼륨이 비어 있고 PG_VERSION이 없는 것을 확인했다. 기존 손상 의심 폴더는 읽거나 삭제하지 않았다.

기존 빈 볼륨:

```text
b3aabc1d41bfbd8b06ec45b1d139efaeb781303938590331da72017e0e3c5c5c
```

현재 Docker 설정의 데이터 경로는 `C:\Users\USER\AppData\Local\Docker\wsl`이다. 이전 시작 오류 로그의 D: 경로와 다르며, 에이전트가 이 경로 변경을 수행한 것은 아니다.

V1은 **새 DB용 JPA 스키마**다. 기존 파일 클러스터의 실스키마를 추출했다고 주장하지 않는다. 과거 DB가 복구되면 별도 비교·백업 후 baseline 절차를 적용한다. [이전 CRC/백업 실패 기록](DATABASE_MIGRATION.md)은 그대로 보존한다.

## 구현

- Flyway 11.7.2와 PostgreSQL 모듈, [V1 SQL](../babychatboot_backend/parenting/src/main/resources/db/migration/V1__initial_schema.sql): 14개 JPA 테이블과 vector_store. 테이블 중복 생성을 숨기는 IF NOT EXISTS는 사용하지 않는다.
- dev Hibernate를 validate로 전환, dev/prod Spring AI 스키마 자동 생성 비활성화. baseline-on-migrate false, clean-disabled true, validate-on-migrate true.
- 벡터 차원은 기존 프로파일 값(dev 3072, prod 768)을 V1 placeholder에 전달한다. 기존 벡터 크기를 변경하지 않는다. VectorSchemaValidator가 실제 컬럼 차원과 설정이 다르면 시작을 거부한다.
- V1은 근사 벡터 인덱스를 생성하지 않는다. prod의 HNSW 설정도 스키마 자동 생성이 꺼져 있으므로 인덱스를 만들지 않는다. 필요한 인덱스는 차원·성능 검토 후 새 버전으로 추가한다.
- DataInitializer와 KnowledgeLoaderService는 기본 비활성화. 각각 `icare.bootstrap.enabled`, `icare.knowledge.load-on-startup`을 명시해야 실행한다. 고정 관리자 초기화 코드는 남아 있으므로 2단계 안전한 초기화 구현 전에는 bootstrap을 켜지 않는다.
- Maven Wrapper를 추적하고 앱을 시작하지 않는 Flyway 관리 프로파일/스크립트를 추가했다. JAR에 application-secret.yml/properties를 포함하지 않는다. JAR 실행 시 환경변수 또는 외부 설정을 공급한다. 기존 로컬 비밀 파일은 수정하지 않았다.

## 실제 수행한 검증

환경: PostgreSQL 16.15, pgvector 0.8.6, `icare-flyway-validation` 컨테이너, C:의 별도 데이터 디렉터리, `127.0.0.1:55432`. 실제 Gemini·메일·서비스 DB는 사용하지 않았다.

검증 완료 후 테스트 컨테이너를 중지했다. 컨테이너·검증 DB·백업은 보존했으며 재검증 시 `docker start icare-flyway-validation`로 시작할 수 있다.

| 항목 | 결과 |
| --- | --- |
| 초기 SQL과 독립적인 Hibernate 생성 스키마의 컬럼·제약조건 비교 | 통과 |
| 빈 DB migrate 후 Hibernate/벡터 validate, 재실행 0건 | 통과 |
| 비어 있지 않은 DB migrate 거부, 명시적 baseline 1 | 통과 |
| baseline 전후 15개 테이블 행·문서/벡터·메타데이터·ID 시퀀스 보존 | 합성 fixture로 통과 |
| 768/3072차원 및 잘못된 프로파일 거부, 호환되지 않는 컬럼 거부 | 통과 |
| 기본 runner 비활성화, 실제 Spring 설정의 Flyway → JPA/벡터 초기화 순서 | 통과 |
| pg_dump → 파일 해시 대조 → 별도 DB pg_restore → 스키마/데이터 비교 | 합성 fixture로 통과 |
| Invoke-Flyway validate/migrate, Compose 문법, JAR package 및 비밀 파일 제외 | 통과 |

JUnit 시나리오 7개를 전체/추가 검증으로 나누어 통과시켰다. 첫 테스트는 Docker 내부 네트워크의 포트 게시 문제로 접속 실패 후 연결 설정을 수정했다. 복원 검사에서는 PostgreSQL의 역할 CHECK 캐스트 표현 차이로 문자열 비교가 실패했다. 다른 제약은 그대로 비교하고 해당 CHECK는 실제 허용/거부 동작으로 비교하여 통과했다. 데이터를 맞추려고 DB를 수정하지 않았다.

테스트 백업 위치:

```text
C:\Users\USER\.codex\visualizations\2026\09\08\01a080bd-d055-76a1-9403-34fda0726f94\flyway-validation\backup-20260908\database.dump
```

34,933바이트, SHA-256 `001B250F652CDA3D69AE771D933ACF8750B48B72322791D423A4B6CD3A7C9145`. **사용자 DB 백업이 아닌 합성 데이터 백업**이다. 백업 당시 RestoreVerification=pending 이후 별도 복원 비교를 통과했다. 원래 D: DB의 백업/복구는 완료되지 않았다.

임베딩 모델/API 가용성·결제, 기존 임베딩 출처, 전체 앱·프론트 연동·접근 제어는 미검증이다. 2단계 전 공개 서비스로 사용하지 않는다.

## 실제 적용 검수안 — 아직 미실행

1. 기능 브랜치 변경을 검수하고 main 병합을 승인받는다.
2. 위 볼륨이 여전히 비어 있고 사용 중이 아님을 재확인한다. 같은 볼륨의 동시 기동을 방지하기 위해 실패한 `tender_feistel`의 **컨테이너만 제거하고 볼륨은 보존**하는 안이다. 적용안 승인 후에만 실행한다.
3. [compose.database.yml](../compose.database.yml)로 동일 볼륨을 사용하는 `parenting-postgres` 하나만 시작한다. DB `parenting_db`, 사용자 `icare`, 임의 생성 비밀번호를 Git 밖 보안 설정으로 공급한다. 포트는 `127.0.0.1:5432`, 추가 서비스 볼륨 생성은 없다.
4. 초기화 직후 빈 DB를 논리 백업한다. **baseline 대신 migrate**를 사용하며 `VectorDimensions=3072`로 V1을 적용한다. 테이블 생성 SQL과 앱 초기 데이터 등록은 별개다.
5. Flyway 이력 1건, JPA 14개 테이블+vector_store, 실제 벡터 차원, 초기 행 수를 확인한다. 관리자/지식 초기화와 애플리케이션은 실행하지 않는다. 2단계 권한·실행 설정 후 실제 서비스를 준비한다.

승인 후 명령 형태(값은 보안 설정으로 공급):

```powershell
# 저장소 루트. ICARE_DB_USER, ICARE_DB_PASSWORD, ICARE_DB_VOLUME 공급 후 실행.
docker compose -p icare-local-db -f compose.database.yml up -d

# ICARE_DB_URL=jdbc:postgresql://127.0.0.1:5432/parenting_db
# ICARE_DB_USER/ICARE_DB_PASSWORD는 초기화한 계정과 같아야 한다.
./scripts/db/Invoke-Flyway.ps1 -Action info -VectorDimensions 3072
./scripts/db/Invoke-Flyway.ps1 -Action migrate -VectorDimensions 3072
./scripts/db/Invoke-Flyway.ps1 -Action validate -VectorDimensions 3072
```

기존 비어 있지 않은 DB는 초기 SQL을 적용하지 않는다. 실제 스키마·데이터·벡터·백업을 비교한 후 `-Action baseline -SchemaReviewed`로 버전 1을 명시한다. 스위치는 실제 검수·승인을 대신하지 않는다. CLI validate도 JPA/벡터 검증을 대신하지 않는다.

## 복구와 재실행

문제가 생기면 서비스를 중지하고 볼륨을 보존한다. `down -v`, Flyway clean, 원본 덮어쓰기는 하지 않는다. 백업을 격리 DB에 복원·검증한 후 연결 대상을 바꾸는 방식으로 복구한다. 사용자 기록이 생긴 후에는 쓰기 중지와 새 기록 보존까지 별도 계획한다. 지금 적용안은 앱을 시작하지 않으므로 새 사용자 기록은 발생하지 않는다.

- [논리 백업](../scripts/db/Backup-PostgresContainer.ps1): pg_dump, binary copy, 원본/사본 SHA-256, 아카이브 목록 검사. 복원 확인은 별도다.
- [검증 복원](../scripts/db/Restore-ValidationBackup.ps1): `icare.purpose=flyway-validation` 라벨 컨테이너의 새 `icare_validation_*` DB로만 복원한다. no-owner/no-privileges이므로 운영 역할·권한 복원은 별도 검토한다.
- [Flyway 관리](../scripts/db/Invoke-Flyway.ps1): 환경변수 미지정 시 거부. info/validate/migrate/baseline을 제공하며 clean은 제공하지 않는다.
- 테스트는 `ICARE_TEST_JDBC_URL=jdbc:postgresql://127.0.0.1:<port>/icare_validation`, `ICARE_TEST_DB_USER`, `ICARE_TEST_DB_PASSWORD`를 명시한 뒤 backend에서 `./mvnw.cmd test`를 실행한다. 개별 검증 DB는 검수용으로 남는다.
- 복원 비교는 추가로 `ICARE_TEST_BACKUP_SOURCE_DB`, `ICARE_TEST_RESTORED_DB`를 서로 다른 검증 DB명으로 공급한다. 일반 test는 환경변수가 없으면 실제 DB/AI에 연결하지 않는다. JAR 재빌드만 필요하면 `./mvnw.cmd package -DskipTests`를 사용한다.

실제 적용·병합 승인은 아직 받지 않았다. 위 검수안은 손상 의심 원본을 버리는 안이 아니다.
