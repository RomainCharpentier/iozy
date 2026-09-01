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

# Quelle livraison tourne, gravé DANS l'image.
#
# Le numéro de version du pom (0.1.0-SNAPSHOT) ne bouge jamais : il ne distingue
# pas deux déploiements, donc il ne répond pas à la seule question qu'on se pose
# devant une mise à jour automatique - « laquelle est en ligne ? ». Le numéro de
# livraison, lui, est le nombre de commits de `main` : il croît d'une livraison
# à l'autre, donc il se COMPARE, et il étiquette aussi bien l'image publiée que
# le commit livré (voir .github/workflows/deploiement.yml).
#
# `dev` par défaut : une image construite à la main sur un poste ne ment pas en
# se faisant passer pour une livraison.
ARG VERSION=dev
ENV IOZYCORE_VERSION=$VERSION
RUN useradd --system --create-home iozycore
USER iozycore
COPY --from=build /build/target/*.jar app.jar

# Volume pour les médias (photos/documents), monté sur le stockage du NAS
VOLUME ["/app/media"]

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
