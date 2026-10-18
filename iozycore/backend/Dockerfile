# --- Build step ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

# --- Run step ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Which release is running, written INTO the image.
#
# The version number of the pom (0.1.0-SNAPSHOT) never changes: it does not tell
# two deployments apart, so it does not answer the one question we ask when an
# automatic update happens - "which one is online?". The release number, on the
# other hand, is a Major.Minor.Patch worked out from the commit messages
# (see web/scripts/version.mjs): it grows with each release, so it can be
# COMPARED, it says what changed, and it labels both the published image and
# the released commit.
#
# `dev` by default: an image built by hand on a workstation does not lie by
# pretending to be a release.
ARG VERSION=dev
ENV IOZYCORE_VERSION=$VERSION
RUN useradd --system --create-home iozycore
USER iozycore
COPY --from=build /build/target/*.jar app.jar

# Volume for media (photos/documents), mounted on the NAS storage
VOLUME ["/app/media"]

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
