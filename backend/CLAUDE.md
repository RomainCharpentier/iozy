# Backend (Spring Boot, Java 21)

A DDD modulith. The top of `backend/README.md` still describes the old split by layers (`domain/`, `application/`, …). The real structure is below.

## Structure

`src/main/java/com/iozycore/`:

| Module | Role |
|---|---|
| `core` | Generic catalogue, ownerships, wishes, tier lists, accounts, sharing, export, statistics, calendar, listings, Gemini, and the **extension points** (for example `ReleaseSource` in `core/insights`) |
| `manga` | French editions, volumes, sources (AniList, Jikan, MAL, Google Books, BnF, Open Library), purchase analysis, stack recognition, shelf import |
| `videogame` | IGDB |
| `boardgame` | BoardGameGeek |
| `custom` | Types defined inside iozycore, with no provider |

Each module has its layers: framework-free domain, use cases, persistence, API. The domain knows neither Spring nor JPA. **A universe never depends on another universe, and the core depends on no universe.** If you need a call in that direction, add an extension point in `core`.

## Run and test

`java` and `mvn` are not installed on the dev machine. Everything goes through Docker. Docker Desktop must be running (`docker version` to check).

Dev stack (API :8080, database, web :8081):

```bash
cd backend && docker compose up --build
```

Tests, from Git Bash (`MSYS_NO_PATHCONV=1` stops `-w /build` from being rewritten as a Windows path):

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd -W):/build" -w /build \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v maven_repo_cache:/root/.m2 \
  -e TESTCONTAINERS_RYUK_DISABLED=true \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  maven:3.9-eclipse-temurin-21 \
  mvn -o -q -B surefire:test -Dtest='ClassATest,ClassBTest'
```

- **Iterate on a subset**, not on the full suite. `surefire:test` alone (no compile lifecycle) has a floor of about 4 s, against 52 s. Separator: a comma (`+` does not work). After you change sources, run `mvn -o test-compile` first (about 15 s). Always use `-o` (the `maven_repo_cache` volume already has everything).
- If only unit logic changed: `-Dtest='!*IntegrationTest,!*HttpContractTest'` (the fast half).
- **Full suite only before a commit**: same command with `mvn -B -o test` (about 95 s). The integration tests share one container through `PostgresIntegrationTest`. Keep this shared base. One `PostgreSQLContainer` per class breaks the Spring context cache (341 s against 80 s).
- The two `TESTCONTAINERS_*` variables are required for Testcontainers on Docker Desktop/WSL2. Without them you get "Connection refused" or a Ryuk timeout.
- **After you delete or move a class, run `mvn -B -o clean test`** at least once. Without `clean`, old `.class` files stay in `target/` (mounted from the host). You then get a false "Schema-validation: missing table" or a `ConflictingBeanDefinitionException` on every test.
- Two Maven runs at the same time on the same `target/` break each other. Do not run a suite in the background during another `mvn`.
- Capture the exit code of `mvn` itself (`code=$?` on its own line), not the one of a final `echo` or of `| head`.

## Docker traps

- After a rebuild that should change behaviour, check that the container runs the new image (`docker inspect <container> --format '{{.Image}}'` against `docker images`). If not, run `docker compose up -d --force-recreate iozycore-api`. Never hide the output of `docker compose build` (`failed to solve` shows there).
- `docker compose up --build -d web` also recreates the API (`depends_on`), so sessions are lost. To rebuild only the web: `docker compose build web && docker compose up -d --no-deps web`.
- `docker-compose.e2e.yml` started from `backend/` reads `backend/.env` (the real keys). The E2E stack must hard-code provider keys to `""`. To test a provider live, use the dev stack, never the E2E stack.

## Conventions

- Aggregates: private constructor, static factory (`create()`, `acquire()`, …), `reconstitute()` to reload. Reference: `Ownership.java`.
- **Flyway migrations**: `V{n}__description.sql`. **Never edit a migration that has shipped.** One more column means: migration + `{Xxx}JpaEntity` + adapter mapper + DTO.
- No business logic in REST controllers.
- **Tests without Mockito**: hand-written in-memory repositories for application logic. Testcontainers (real PostgreSQL) for JPA/SQL. Inline fixtures for parsing external sources. **Never a real network call in a test.**
- A failing external source returns an empty list for that source (`WARN` log). It never returns an error.

## Owner isolation (read before you write a repository)

Private tables have an `owner_id` column marked `@TenantId`. Hibernate filters every query and fills the column on insert, from `ProprietaireCourant`. With no known account, the owner is `PERSONNE` (sees nothing).

Two holes that `@TenantId` does not close:
- JPA `findById` loads by primary key **with no query**, so with no filter. Use the derived `findOneById` methods.
- `deleteById` and bulk `deleteBy…` ignore the filter. Read first (filtered), then delete what was found.

The only legitimate crossing is the share link (`AuNomDe.executer(owner, …)` in `PublicShareController`). `JdbcDonneesParProprietaire` (account deletion) is the only code that goes over the wall with SQL.

## Security and sessions

- Everything answers 401 without a session, except `GET /api/auth/etat`, `POST /api/auth/login`, `POST /api/auth/register` and `/api/public/**`. Swagger is closed too.
- The visitor ("Visiter sans compte") has no owner. It is read-only on the server (`SecurityConfig` refuses everything except `GET`) and sees only the catalogue.
- CSRF: the token is in the readable `XSRF-TOKEN` cookie and is sent back as `X-XSRF-TOKEN`. The explicit `CsrfTokenRequestAttributeHandler` in `SecurityConfig` is needed. Do not remove it.
- A 404 goes through the security chain again (`dispatcherTypeMatchers(ERROR).permitAll()`). Only `PorteSurUnVraiServeurTest` sees this case (MockMvc does not replay it).
- Sessions live in memory. A restart logs everyone out. This is accepted.
- A new origin that serves the web (port, domain) must be added to `web.allowed-origins` (`CorsConfig`). Otherwise writes answer 403 "Invalid CORS request".
- Creating an account after the first one is closed until `IOZYCORE_INVITE_CODE` is set. Missing configuration closes the door. It never opens it.

## External providers

For quotas, error codes and the fallback order, see "Quand un fournisseur se tait" in the root `README.md`. Order rule: the source with the most calls available goes first. Google Books is the only one with a daily quota (429, reset around 9:00 Paris time). Gemini (AI help) can answer 503 (load) or 429 (daily quota). Plan a fallback.

Gemini has a fallback model (`GEMINI_FALLBACK_MODEL`) for when the main one stays saturated. A 503 or 429 is retried before a failure is reported. A reached quota is reported as a quota, not as an outage to retry.

Settings live in `backend/.env` (template: `.env.example`, the full list is the truth): `BGG_APPLICATION_TOKEN`, `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`, `MAL_CLIENT_ID`, `GOOGLE_BOOKS_API_KEY`/`GOOGLE_BOOKS_BACKUP_API_KEYS`, `GEMINI_API_KEY`/`GEMINI_MODEL`/`GEMINI_FALLBACK_MODEL`, `IOZYCORE_INVITE_CODE`, `WEB_ALLOWED_ORIGINS`, `SESSION_COOKIE_SECURE`, `RELEASES_REFRESH_*`.

Existing extension points (interfaces in `core`, implementations at the root of each universe): `DiscoverySource`, `SeriesProgressSource`, `OwnedValueSource`, `CoverImageCheck`, `EditionLinker`, `EntityDeletionGuard`, `VariantDeletionHook`, `TransferModule`, `ReleaseSource`. Spring Modulith 1.2.x (Boot 3.3 line): run `ModulesTest` before any commit that touches packages. HTTP routes do not move when a module moves.
