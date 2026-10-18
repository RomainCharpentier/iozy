---
name: test-backend
description: Lance des tests du backend via Docker (java et mvn ne sont pas installés). Sous-ensemble ciblé en itération, suite complète avant commit.
---

# Tests du backend

Docker Desktop doit tourner (`docker version`). Depuis Git Bash, à la racine du dépôt, dans `iozycore/backend/`.

**Itération** : un sous-ensemble ciblé (~4 s). Si des sources ont changé, compile d'abord (`mvn -o -q -B test-compile`, ~15 s). Séparateur de classes : la virgule.

```bash
cd iozycore/backend && MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd -W):/build" -w /build \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v maven_repo_cache:/root/.m2 \
  -e TESTCONTAINERS_RYUK_DISABLED=true \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  maven:3.9-eclipse-temurin-21 \
  mvn -o -q -B surefire:test -Dtest='ClasseATest,ClasseBTest'
```

**Variantes** :
- Logique unitaire seule : `-Dtest='!*IntegrationTest,!*HttpContractTest'`.
- Suite complète (avant commit, ~95 s) : remplace la dernière ligne par `mvn -B -o test`.
- Après avoir supprimé ou déplacé une classe : `mvn -B -o clean test` au moins une fois.

**Règles** :
- Toujours `-o`. Jamais deux Maven en même temps sur le même `target/`.
- Lis le code de sortie de `mvn` lui-même (`code=$?` sur sa propre ligne), pas celui d'un `echo` ou d'un `| head`.
- Ne masque jamais la sortie de `docker compose build`.
