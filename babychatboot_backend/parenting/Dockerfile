# 1. 자바 17 환경 준비
FROM eclipse-temurin:17-jdk

# 2. 작업할 폴더 만들기
WORKDIR /app

# 3. 빌드된 JAR 파일을 컨테이너 안으로 복사
# (미리 mvnw package로 JAR를 만들어둬야 합니다)
COPY target/*.jar app.jar

# 4. 8080 포트 열기
EXPOSE 8080

# 5. 실행!
ENTRYPOINT ["java", "-jar", "app.jar"]