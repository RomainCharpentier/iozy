# Backend (Spring Boot, Java 21)

Modulith DDD. La section « Architecture » de `backend/README.md` décrit la même structure, plus en détail. La version courte est ci-dessous.

## Structure

`src/main/java/com/iozycore/` :

| Module | Rôle |
|---|---|
| `core` | Catalogue générique, possessions, envies, tier lists, comptes, partage, export, statistiques, calendrier, annonces, Gemini, et les **points d'extension** (par exemple `ReleaseSource` dans `core/insights`) |
| `manga` | Éditions françaises, tomes, sources (AniList, Jikan, MAL, Google Books, BnF, Open Library), analyse d'achat, reconnaissance de piles, import d'étagère |
| `videogame` | IGDB |
| `boardgame` | BoardGameGeek |
| `custom` | Types définis dans iozycore, sans fournisseur |

Chaque module a ses couches : domaine sans framework, cas d'usage, persistance, API. Le domaine ne connaît ni Spring ni JPA. **Un univers ne dépend jamais d'un autre univers, et le cœur ne dépend d'aucun univers.** Si tu as besoin d'un appel dans ce sens, crée un point d'extension dans `core`.

## Lancer et tester

`java` et `mvn` ne sont pas installés sur la machine de dev : tout passe par Docker. Docker Desktop doit tourner (`docker version` pour vérifier).

Pile de dev (API :8080, base, web :8081) :

```bash
cd backend && docker compose up --build
```

Tests, depuis Git Bash (`MSYS_NO_PATHCONV=1` évite que `-w /build` soit réécrit en chemin Windows) :

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$(pwd -W):/build" -w /build \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v maven_repo_cache:/root/.m2 \
  -e TESTCONTAINERS_RYUK_DISABLED=true \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  maven:3.9-eclipse-temurin-21 \
  mvn -o -q -B surefire:test -Dtest='ClasseATest,ClasseBTest'
```

- **Itère sur un sous-ensemble**, pas sur la suite complète. `surefire:test` seul (sans cycle de compilation) tient un plancher d'environ 4 s contre 52 s. Séparateur : la virgule (`+` ne marche pas). Après avoir modifié des sources, lance d'abord `mvn -o test-compile` (~15 s). Toujours `-o` (le volume `maven_repo_cache` a déjà tout).
- Seule la logique unitaire a bougé : `-Dtest='!*IntegrationTest,!*HttpContractTest'` (la moitié rapide).
- **Suite complète seulement avant un commit** : même commande avec `mvn -B -o test` (~95 s). Les tests d'intégration partagent un seul conteneur via `PostgresIntegrationTest`. Garde cette base commune : un `PostgreSQLContainer` par classe casse le cache de contextes Spring (341 s contre 80 s).
- Les deux variables `TESTCONTAINERS_*` sont indispensables pour Testcontainers sous Docker Desktop/WSL2. Sans elles : « Connection refused » ou timeout Ryuk.
- **Après avoir supprimé ou déplacé une classe, lance `mvn -B -o clean test`** au moins une fois. Sans `clean`, les anciens `.class` restent dans `target/` (monté depuis l'hôte) : faux « Schema-validation: missing table » ou `ConflictingBeanDefinitionException` sur tous les tests.
- Deux Maven simultanés sur le même `target/` se marchent dessus. Ne lance pas une suite en arrière-plan pendant un autre `mvn`.
- Capture le code de sortie de `mvn` lui-même (`code=$?` sur sa propre ligne), pas celui d'un `echo` final ni d'un `| head`.

## Pièges Docker

- Après un rebuild censé changer le comportement, vérifie que le conteneur tourne sur la nouvelle image (`docker inspect <conteneur> --format '{{.Image}}'` contre `docker images`). Sinon : `docker compose up -d --force-recreate iozycore-api`. Ne masque jamais la sortie de `docker compose build` (`failed to solve` s'y lit).
- `docker compose up --build -d web` recrée aussi l'API (`depends_on`) : sessions perdues. Pour ne reconstruire que le web : `docker compose build web && docker compose up -d --no-deps web`.
- `docker-compose.e2e.yml` lancé depuis `backend/` lit `backend/.env` (les vraies clés). La pile E2E doit fixer les clés de fournisseurs à `""` en dur. Pour tester un fournisseur en direct, utilise la pile de dev, jamais la pile E2E.

## Conventions

- Agrégats : constructeur privé, factory statique (`create()`, `acquire()`…), `reconstitute()` pour recharger. Référence : `Ownership.java`.
- **Migrations Flyway** : `V{n}__description.sql`. **Ne modifie jamais une migration déjà livrée**, pas même un commentaire. Une colonne de plus = migration + `{Xxx}JpaEntity` + mapper de l'adaptateur + DTO.
- Un contrôleur traduit le HTTP et appelle un cas d'usage, jamais un dépôt (`LayersTest`). Erreurs d'un cas d'usage : `IllegalArgumentException` (400), `IllegalStateException` (409), `NotFoundException` (404).
- Lombok hors domaine seulement, sans `@Data` ni `@Setter`.
- Doubles de test partagés : `src/test/java/com/iozycore/core/testing`.
- **Tests sans Mockito** : dépôts en mémoire écrits à la main pour la logique applicative ; Testcontainers (vrai PostgreSQL) pour JPA/SQL ; fixtures inline pour le parsing de sources externes. **Jamais d'appel réseau réel dans un test.**
- Une source externe en panne renvoie une liste vide pour cette source (log `WARN`), jamais une erreur.
- Le code, les commentaires et les logs s'écrivent en anglais ; les messages d'erreur d'API que le web affiche restent en français.

## Isolation par propriétaire (à lire avant d'écrire un dépôt)

Les tables privées ont une colonne `owner_id` annotée `@TenantId`. Hibernate filtre toute requête et remplit la colonne à l'insertion, depuis `ProprietaireCourant`. Sans compte connu, le propriétaire vaut `PERSONNE` (ne voit rien).

Deux trous que `@TenantId` ne bouche pas :
- `findById` JPA charge par clé primaire **sans requête**, donc sans filtre. Utilise les `findOneById` dérivés.
- `deleteById` et les `deleteBy…` en masse ignorent le filtre. Lis d'abord (filtré), supprime ensuite ce qui a été trouvé.

Le seul franchissement légitime est le lien de partage (`readOnBehalfOf.run(proprietaire, …)` dans `SharedSpaceQuery`, port `ReadOnBehalfOf` implémenté sur `AuNomDe`). `JdbcDonneesParProprietaire` (suppression de compte) est le seul code qui passe en SQL par-dessus la cloison.

## Sécurité et sessions

- Tout répond 401 sans session, sauf `GET /api/auth/etat`, `POST /api/auth/login`, `POST /api/auth/register` et `/api/public/**`. Swagger est fermé aussi.
- Le visiteur (« Visiter sans compte ») n'a aucun propriétaire. Il est en lecture seule côté serveur (`SecurityConfig` refuse tout sauf `GET`) et ne voit que le catalogue.
- CSRF : le jeton est dans le cookie lisible `XSRF-TOKEN`, renvoyé en `X-XSRF-TOKEN`. Le `CsrfTokenRequestAttributeHandler` explicite de `SecurityConfig` est nécessaire. Ne le retire pas.
- Un 404 repasse par la chaîne de sécurité (`dispatcherTypeMatchers(ERROR).permitAll()`). Seul `PorteSurUnVraiServeurTest` voit ce cas (MockMvc ne le rejoue pas).
- Les sessions vivent en mémoire. Un redémarrage déconnecte tout le monde. C'est assumé.
- Une nouvelle origine qui sert le web (port, domaine) doit être ajoutée à `web.allowed-origins` (`CorsConfig`). Sinon les écritures répondent 403 « Invalid CORS request ».
- La création d'un compte après le premier est fermée tant que `IOZYCORE_INVITE_CODE` n'est pas défini. L'absence de configuration ferme la porte, elle ne l'ouvre jamais.

## Fournisseurs externes

Pour les quotas, les codes d'erreur et l'ordre de repli, voir « Quand un fournisseur se tait » dans le `README.md` racine. Règle d'ordre : la source qui a le plus d'appels disponibles passe en premier. Google Books est la seule avec un quota journalier (429, remis à zéro vers 9 h heure de Paris). Gemini (assistance IA) peut répondre 503 (charge) ou 429 (quota du jour) : prévois un repli.

Gemini a un modèle de repli (`GEMINI_FALLBACK_MODEL`) quand le principal reste saturé. Un 503 ou un 429 est réessayé avant d'annoncer un échec, et un quota atteint se dit comme tel, pas comme une panne à réessayer.

Les réglages vivent dans `backend/.env` (modèle : `.env.example`, la liste complète fait foi) : `BGG_APPLICATION_TOKEN`, `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`, `MAL_CLIENT_ID`, `GOOGLE_BOOKS_API_KEY`/`GOOGLE_BOOKS_BACKUP_API_KEYS`, `GEMINI_API_KEY`/`GEMINI_MODEL`/`GEMINI_FALLBACK_MODEL`, `IOZYCORE_INVITE_CODE`, `WEB_ALLOWED_ORIGINS`, `SESSION_COOKIE_SECURE`, `RELEASES_REFRESH_*`.

Points d'extension existants (interfaces dans `core`, implémentations à la racine de chaque univers) : `DiscoverySource`, `SeriesProgressSource`, `OwnedValueSource`, `CoverImageCheck`, `EditionLinker`, `EntityDeletionGuard`, `VariantDeletionHook`, `TransferModule`, `ReleaseSource`. Spring Modulith 1.2.x (ligne Boot 3.3) : lance `ModulesTest` avant tout commit qui touche aux paquets. Les routes HTTP ne bougent pas quand un module bouge.
