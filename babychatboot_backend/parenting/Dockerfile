FROM eclipse-temurin:17-jdk-jammy@sha256:400014962ad7224461f945bb1cc3d7d5a1927ce15b8245b72d9cedcda554cd2a AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw
COPY src src
COPY docker/HealthCheck.java docker/HealthCheck.java
RUN ./mvnw -B -DskipTests package && javac -d /build/health docker/HealthCheck.java

FROM eclipse-temurin:17-jre-jammy@sha256:e17d77fb030dd4b642dc078d048a5fb9efcb3676ee20305d905949105a6ccd5a
WORKDIR /app
RUN mkdir -p /app/uploads && chown -R 10001:10001 /app
COPY --from=build /build/target/parenting-0.0.1-SNAPSHOT.jar /app/app.jar
COPY --from=build /build/health/HealthCheck.class /app/HealthCheck.class
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=4 CMD ["java", "-cp", "/app", "HealthCheck"]
ENTRYPOINT ["java", "-jar", "/app/app.jar"]