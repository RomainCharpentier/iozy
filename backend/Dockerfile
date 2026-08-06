# --- Étape de build ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

# --- Étape d'exécution ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN useradd --system --create-home iozycore
USER iozycore
COPY --from=build /build/target/*.jar app.jar

# Volume pour les médias (photos/documents), monté sur le stockage du NAS
VOLUME ["/app/media"]

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
