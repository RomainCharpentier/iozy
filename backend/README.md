# IozyCore — Backend

## Le projet

IozyCore est une base de connaissances personnelle et auto-hébergée : un
"second cerveau" pour cataloguer une collection
(aujourd'hui : mangas, jeux vidéo, jeux de société), suivre ce qu'on
possède (`Ownership`) indépendamment de ce qu'on a vécu (`Experience` —
lu/joué/terminé, note, commentaire), avec enrichissement automatique des
métadonnées via des API publiques gratuites (Jikan pour les mangas, BGG
pour les jeux de société, IGDB pour les jeux vidéo, Open Library pour le
lookup ISBN).

Document de conception complet (vision, personas, DDD, modèle de données,
UML, roadmap - 21 étapes) : `../docs/CONCEPTION.md`. Ce
README documente l'état du code tel qu'il existe, pas l'intention de
départ — en cas de divergence entre les deux, le code fait foi.

### Architecture

Clean Architecture + DDD, en monolithe modulaire :

```
domain/            agrégats métier purs (aucune dépendance Spring/JPA)
  catalog/          Entity, Variant, Tag, Relationship, EntityType (partagé, pas de owner -
                     éditeur de types dynamique, plus de constantes codées en dur)
  ownership/        Ownership (possession d'un exemplaire)
  experience/        Experience (vécu : lu/joué/terminé)
  wishlist/          WishlistEntry
  shared/            DomainEvent, DefaultOwner (le compte d'origine, et « personne »)
  user/              AppUser (les comptes, depuis le 2026-08-29)
application/        orchestration des cas d'usage (QuickAddService, EntityDeletionService...)
infrastructure/     adaptateurs JPA qui implémentent les ports du domaine
  persistence/       une paire {Xxx}JpaEntity + Jpa{Xxx}RepositoryAdapter par agrégat
metadata/           Bounded Context "Metadata Enrichment" (Jikan, BGG, Open Library)
insights/           Bounded Context "Insights" (StatsService, DiscoveryService - lecture seule)
api/                contrôleurs REST + DTOs, un package par ressource
  config/            configuration transverse (CorsConfig - autorise les
                     requêtes d'écriture du client Web, voir web/README.md
                     et web.allowed-origins dans application.yml), ne
                     correspond pas au découpage "un package par ressource"
                     du reste de api/
  entitytype/        EntityTypeController (éditeur de types dynamique)
```

Chaque agrégat du domaine a une interface de repository (`EntityRepository`,
`OwnershipRepository`...) dans son package `domain/`, et une seule
implémentation JPA dans `infrastructure/persistence/`. Le domaine ne connaît
jamais Spring ni JPA — seule l'infrastructure en dépend.

### Comment travailler sur ce projet

**Ajouter une fonctionnalité qui touche un agrégat existant** (ex: un
nouveau champ sur `Ownership`) :
1. Modifier l'agrégat dans `domain/` (constructeur privé + factory statique
   `acquire()`/`create()`/`record_()`, `reconstitute()` pour recharger depuis
   la persistance — voir `Ownership.java` comme référence).
2. Ajouter la colonne via une nouvelle migration Flyway
   (`V{n}__description.sql`, jamais modifier une migration déjà livrée).
3. Répercuter dans le `{Xxx}JpaEntity` et le mapper `to Jpa`/`toDomain` de
   l'adaptateur correspondant.
4. Exposer si besoin dans le DTO de réponse REST (`api/dto/`).

**Ajouter un nouveau Bounded Context** (comme `metadata` ou `insights`) :
package dédié à la racine, un ou des services `@Service`, jamais de logique
métier dans les contrôleurs REST.

**Tests** — deux styles, pas de mocks (Mockito n'est pas utilisé) :
- Logique applicative pure : repositories en mémoire (`Map<UUID, X>`) écrits
  à la main dans le fichier de test (voir `QuickAddServiceTest`,
  `DiscoveryServiceTest` comme modèles).
- Comportement JPA/SQL réel : Testcontainers + vrai PostgreSQL (voir
  `EntityPersistenceIntegrationTest`).
- Parsing XML/JSON de sources externes : tests sur `.parse()` avec des
  fixtures inline, jamais d'appel réseau réel dans un test (voir
  `BggThingFetcherTest`, `JikanMetadataProviderTest`).

**Conventions** : code et identifiants en anglais, commentaires et
discussions en français (décision explicite, assumée dans tout le code).
Les commentaires qui référencent une "étape N" renvoient au document de
conception - à consulter en cas de doute sur le "pourquoi" d'un choix.

### État actuel (voir aussi "Limites connues" dans `../README.md`)

Construit : éditeur de types dynamique (`entity-types`, plus de 3 types
figés en dur - voir section dédiée), ajout rapide avec déduplication,
Ownership/Experience/Wishlist/Tag/Relationship, recherche transversale,
statistiques, découverte heuristique (Jikan/BGG/IGDB), import de collection
BGG, comptes et cloisonnement par propriétaire (voir « Comptes et session »).

`GET /api/wishlist` (liste complète, à ne pas confondre avec
`GET /api/wishlist/lookup` qui vérifie une seule Entity) a été ajouté pour
l'onglet Wishlist du client Web (`../web`) - `WishlistEntryRepository.findAll()`
et son implémentation JPA existaient déjà (utilisés par Insights), seule la
route de contrôleur manquait.

Volontairement pas construit : validation serveur des `customFieldKeys` d'un
type contre les attributs d'une Entity (reste descriptif).

## Prérequis

**Un seul prérequis : Docker + Docker Compose.** Pas besoin d'installer Java,
Maven ni PostgreSQL sur ta machine — tout tourne en conteneur.

## 1. Lancer l'API en local

```bash
docker compose up --build
```

Ça démarre 2 conteneurs : l'API Spring Boot (port 8080) et PostgreSQL (port
5432, exposé en local pour pouvoir l'inspecter avec un client SQL si besoin).
Les migrations Flyway (`V1__init_schema.sql`) s'exécutent automatiquement au
démarrage — la base est prête avec les 3 `EntityType` du MVP déjà insérés.

Premier démarrage : le build Maven télécharge les dépendances, compte
1 à 2 minutes. Les démarrages suivants sont quasi instantanés (cache Docker).

**Vérifier que ça tourne :**
```bash
curl http://localhost:8080/api/auth/etat
# {"aucunCompte":true,...} -> l'API répond. Tout le reste demande un compte,
# voir « Comptes et session » plus bas.
```

## 2. Tester l'API

**Option A — Swagger UI (le plus simple, aucun outil à installer) :**
Ouvre http://localhost:8080/swagger-ui.html dans ton navigateur. **Connecte-toi
d'abord** (l'app web, ou `POST /api/auth/register` sur une instance neuve) :
Swagger est fermé comme le reste, et le cookie de session du navigateur vaut
pour lui aussi.

**Option B — fichier `requests.http` fourni :**
Si tu utilises VS Code, installe l'extension "REST Client" et ouvre
`requests.http` : un clic sur "Send Request" au-dessus de chaque bloc exécute
la requête. Compatible aussi avec le client HTTP intégré à IntelliJ/DataGrip.
Couvre les 9 requêtes clés : ajout rapide, consultation, vérification avant
achat, expérience (valide et invalide), tag, suppression bloquée...

**Option C — curl direct**, par exemple pour rejouer le parcours 1 :
```bash
curl -X POST http://localhost:8080/api/entities/quick-add \
  -H "Content-Type: application/json" \
  -d '{"entityTypeId":"00000000-0000-0000-0000-000000000001","title":"Death Note","condition":"NEW"}'
```

## 3. Lancer les tests (sans installer Java ni Maven)

Les tests unitaires (domaine) et d'intégration (Testcontainers, qui lance un
vrai PostgreSQL jetable) tournent dans un conteneur Maven :

```bash
docker run --rm \
  -v "$(pwd)":/build -w /build \
  -v /var/run/docker.sock:/var/run/docker.sock \
  maven:3.9-eclipse-temurin-21 mvn test
```

Le montage du socket Docker (`/var/run/docker.sock`) est nécessaire car les
tests d'intégration démarrent eux-mêmes un conteneur PostgreSQL via
Testcontainers ("Docker-in-Docker"). Si tu as Java 21 et Maven installés en
local, un simple `mvn test` suffit aussi.

## 4. Arrêter et nettoyer

```bash
docker compose down        # arrête les conteneurs, garde les données
docker compose down -v     # arrête et supprime aussi les volumes (repart à zéro)
```

## Fichiers de déploiement

- `docker-compose.yml` — usage local/test, tel que décrit ci-dessus.
- `docker-compose.synology.yml` — déploiement réel sur le NAS (reverse proxy
  Traefik + HTTPS Let's Encrypt automatique) : nécessite un `.env` rempli
  (voir `.env.example`) et un vrai nom de domaine pointant vers le NAS.
- `scripts/backup.sh` — sauvegarde PostgreSQL, à planifier en prod uniquement.

## Éditeur de types dynamique

`entity_type` est une vraie table (déjà créée par `V1__init_schema.sql`,
seedée avec les 3 types historiques MANGA/VIDEO_GAME/BOARD_GAME), pas des
constantes Java figées - `GET/POST/PATCH/DELETE /api/entity-types`
permettent de lister/créer/modifier/supprimer des types (label, types
d'expérience autorisés, champs personnalisés). Le `code` est normalisé en
UPPER_SNAKE_CASE à la création et ne change jamais ensuite (même invariant
que `entityTypeId` sur `Entity` - changer de code ferait perdre le sens des
attributs déjà enregistrés). Suppression bloquée (409) tant qu'au moins une
`Entity` référence encore le type (`EntityTypeDeletionNotAllowedException`,
même garde-fou que la suppression d'une `Entity`).

Les fonctionnalités intrinsèquement liées à une source externe précise
(lookup ISBN, import BGG, découverte) restent câblées sur les 3 codes
historiques via `findByCode(...)`, jamais sur un id figé ni généralisées à
un type créé par l'utilisateur - éditer le label/schema d'un de ces 3
types n'interrompt donc pas ces fonctionnalités.

## Metadata Enrichment (recherche automatique)

`GET /api/metadata/search?entityTypeId=...&query=...` interroge automatiquement
**Jikan** (mangas, aucune clé requise), **BGG** (jeux de société, token
d'application requis pour un usage conforme — voir section dédiée ci-dessous)
ou **IGDB** (jeux vidéo, identifiants Twitch obligatoires - pas de mode
dégradé, voir section dédiée) selon le type demandé, et renvoie une liste de
candidats (titre, image si disponible, attributs).

`GET /api/metadata/lookup-barcode?entityTypeId=...&barcode=...` retrouve un
manga à partir de son ISBN (le code-barres scanné) via **Open Library**
(aucune clé requise) — répond 404 si l'ISBN est inconnu. Couvre uniquement
MANGA : les jeux vidéo/société utilisent des codes-barres UPC/EAN non-ISBN,
hors du périmètre d'Open Library.

Le résultat choisi peut être transmis tel quel dans `attributes` du corps de
`POST /api/entities/quick-add` (voir `requests.http`, requêtes 10-12) pour
pré-remplir l'Entity sans ressaisie manuelle.

Une panne de Jikan/BGG/IGDB ne fait jamais échouer la recherche : elle
renvoie simplement une liste vide pour la source en panne (voir les logs
`WARN`), l'utilisateur peut toujours saisir le titre à la main.

## ⚠️ Token BGG requis pour un usage conforme

Depuis juillet 2025, BGG exige un enregistrement d'application et un token
Bearer pour la quasi-totalité de son API XML (recherche, collection,
détails de jeu, liste tendance) - voir
[boardgamegeek.com/using_the_xml_api](https://boardgamegeek.com/using_the_xml_api).
Sans token configuré (`BGG_APPLICATION_TOKEN` dans `.env`), les fonctionnalités
BGG (recherche, import de collection, découverte de jeux) continuent de
fonctionner pour tester en local, mais **ne sont pas conformes aux conditions
actuelles de BGG**.

**Marche à suivre complète :**

1. Crée un compte sur [boardgamegeek.com](https://boardgamegeek.com) si tu
   n'en as pas déjà un (gratuit).
2. Connecté, va sur [boardgamegeek.com/applications](https://boardgamegeek.com/applications) →
   "Register Application" (ou directement
   [boardgamegeek.com/applications/create](https://boardgamegeek.com/applications/create)).
3. Remplis le formulaire : un nom (ex. `IozyCore`), une description d'une
   phrase, et choisis **"Non-commercial"** comme type de licence (gratuit,
   adapté à un usage personnel).
4. Envoie le formulaire et attends l'approbation - BGG traite ça
   manuellement, compte de quelques jours à environ une semaine.
5. Une fois approuvé, retourne sur `boardgamegeek.com/applications`, clique
   "Tokens" à côté de ton application, et génère un token (un UUID du genre
   `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) - note-le quelque part de sûr.
6. Dans le projet : copie `.env.example` en `.env` si ce n'est pas déjà fait,
   renseigne `BGG_APPLICATION_TOKEN=<ton-token>`, puis relance
   `docker compose up --build` pour que la variable soit prise en compte.

Le guide `../README.md` (racine du repo) détaille chaque étape avec plus de
contexte si besoin. Aucune clé n'est nécessaire pour Jikan (mangas) ou Open
Library (lookup ISBN).

## ⚠️ Identifiants IGDB/Twitch requis (pas de mode dégradé)

IGDB (jeux vidéo) appartient à Twitch et s'authentifie via son flux OAuth2
client-credentials (`IgdbTokenProvider` - token mis en cache en mémoire,
rafraîchi automatiquement à expiration). **Contrairement à BGG, il n'y a
aucun mode dégradé** : sans `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET` configurés
dans `.env`, la recherche et la découverte jeux vidéo renvoient simplement
une liste vide (voir les logs `WARN` de `IgdbTokenProvider`).

**Marche à suivre complète :**

1. Crée un compte sur [twitch.tv](https://www.twitch.tv) si tu n'en as pas
   déjà un (gratuit).
2. Connecté, va sur
   [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) →
   "Register Your Application" (nom libre, OAuth Redirect URL
   `http://localhost`, catégorie "Application Integration").
3. Une fois l'application créée, récupère le **Client ID** (affiché
   directement) et génère un **Client Secret** ("New Secret", affiché une
   seule fois - note-le quelque part de sûr).
4. Dans le projet : copie `.env.example` en `.env` si ce n'est pas déjà
   fait, renseigne `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`, puis relance
   `docker compose up --build`.

Le guide `../README.md` (racine du repo) détaille chaque étape avec plus de
contexte si besoin.

## Client ID MyAnimeList (optionnel, relais quand Jikan est down)

Jikan est un wrapper tiers non-officiel : il doit lui-même se reconnecter à
MyAnimeList à chaque requête, et MyAnimeList le bloque/throttle par
intermittence (pannes `504 "failed to connect to MyAnimeList"`, en général
temporaires mais imprévisibles). `MyAnimeListMetadataProvider` interroge à la
place l'**API officielle** MyAnimeList v2 (authentifiée par un simple Client
ID, pas un flux OAuth complet) - elle n'est pas concernée par ces blocages
puisqu'elle sert MyAnimeList directement.

**Complète Jikan, ne le remplace jamais** : les deux fournisseurs sont
agrégés par `MetadataSearchService`. Sans `MAL_CLIENT_ID` configuré, ce
fournisseur reste simplement absent (`supports()` renvoie `false`) et Jikan
continue de fonctionner seul, comme avant - comportement inchangé.

**Marche à suivre complète :**

1. Crée un compte sur [myanimelist.net](https://myanimelist.net) si tu n'en
   as pas déjà un (gratuit).
2. Connecté, va sur
   [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) → "Create
   ID".
3. Remplis le formulaire : nom d'app libre (ex. `IozyCore`), App Type
   "web", Redirect URL `http://localhost` (jamais réellement utilisée pour
   la recherche publique, mais requise par le formulaire), Homepage URL
   optionnelle.
4. Une fois créée, l'application affiche directement un **Client ID** -
   pas de Client Secret à générer, pas d'attente d'approbation manuelle
   (contrairement à BGG).
5. Dans le projet : copie `.env.example` en `.env` si ce n'est pas déjà
   fait, renseigne `MAL_CLIENT_ID=<ton-client-id>`, puis relance
   `docker compose up --build`.

## Découverte heuristique (mangaka / catégories BGG / similarité IGDB)

`GET /api/insights/discover?entityTypeCode=MANGA|BOARD_GAME|VIDEO_GAME` -
suggestions justifiées par un signal concret, jamais un moteur de
recommandation IA :

- **Mangas** : d'autres œuvres du même mangaka que tes mangas les mieux notés
  (via Jikan), en excluant ce que tu possèdes déjà.
- **Jeux de société** : jeux tendance BGG (`/hot`) partageant des catégories
  ou mécaniques avec tes jeux possédés (via `/thing`, limité aux jeux dont le
  `bggId` a été capturé - recherche ou import de collection).
- **Jeux vidéo** : jeux "similaires" (champ `similar_games`, calculé par
  IGDB lui-même - plus simple que le croisement catégories/mécaniques de
  BGG) à tes jeux possédés, limité aux jeux dont l'`igdbId` a été capturé.

## Statistiques (UC6)

`GET /api/insights/stats` renvoie un instantané agrégé de la collection :
nombre total d'Entity/Ownership actives, taille de la wishlist, nombre
d'Experience enregistrées cette année, puis par type (Manga/Jeu vidéo/Jeu
de société) : nombre d'Entity, d'Ownership actives, d'Experience, et note
moyenne. Complété par les 5 tags les plus utilisés.

Calculé par agrégation directe sur les repositories existants à chaque
appel, pas via un modèle de lecture événementiel séparé - à l'échelle d'une
collection personnelle, la ceremony d'un vrai event-sourcing n'apporterait
rien (choix déjà posé à l'étape 8 de la conception).

## Recherche transversale (UC4)

`GET /api/entities/search?q=...&entityTypeId=...&tagId=...` recherche dans
ta propre collection (par titre, insensible à la casse), tous types
confondus par défaut - `q`, `entityTypeId` et `tagId` sont chacun optionnels
et combinables (ex: tous les mangas tagués "seinen", sans texte de
recherche). C'est la vraie recherche dans ta collection, distincte de
`/api/metadata/search` qui interroge des sources externes (Jikan/BGG) pour
préparer un ajout.

## Import de collection BGG

`POST /api/metadata/bgg/import?username=...` récupère tous les jeux marqués
"possédés" dans la collection BoardGameGeek publique d'un utilisateur, et les
importe via le même mécanisme que l'ajout rapide (donc avec la même
déduplication par titre - relancer l'import ne crée jamais de doublons,
ça ajoute juste une Ownership de plus sur les Entity déjà connues).

Particularité de l'API BGG : elle répond parfois `202` le temps de préparer
l'export côté serveur (comportement normal, pas une erreur) - le backend
réessaie automatiquement jusqu'à 5 fois avec un délai de 2s, avant de
renvoyer un `503` si BGG ne répond toujours pas.

Réponse : `{ totalFound, created, matchedExisting, failed }` - `failed`
compte les jeux dont l'import a échoué individuellement (titre vide,
etc.) sans faire échouer les autres.

## Déduplication à l'ajout rapide (UC1)

`POST /api/entities/quick-add` vérifie désormais si une Entity du même type
porte déjà exactement le même titre (comparaison insensible à la casse)
avant d'en créer une nouvelle. Si oui, aucun doublon n'est créé dans le
Catalog : une nouvelle Ownership est simplement rattachée à l'Entity
existante (par exemple un second exemplaire du même tome, ou un re-scan
accidentel du même code-barres). La réponse `{ "entityId": ..., "matchedExistingEntity": ... }`
indique si un doublon a été évité, pour que le client (iOS) puisse en
informer l'utilisateur plutôt que de le faire silencieusement.

Les attributs pré-remplis (issus d'une recherche Metadata Enrichment) ne
remplacent jamais un attribut déjà renseigné sur l'Entity existante — ils
ne comblent que ce qui manque.

## Comptes et session (depuis le 2026-08-29)

L'API **demande une session**. Sans elle, tout répond 401 sauf trois choses :
`GET /api/auth/etat`, `POST /api/auth/login` et `POST /api/auth/register` (il
faut bien pouvoir entrer), et `/api/public/**` — les liens de partage, dont le
destinataire n'a par définition pas de compte. **Swagger aussi est fermé** :
une documentation qui liste 92 routes est une carte, et elle n'apporte rien à
qui n'a pas le droit de les appeler. On se connecte dans le navigateur, la
session vaut ensuite pour Swagger.

**Le premier compte est libre**, et il **reprend l'identifiant du propriétaire
par défaut** (`DefaultOwner.ID`) : la collection déjà en base devient la
sienne, sans qu'une ligne ne bouge. Les suivants exigent un code d'invitation
(`IOZYCORE_INVITE_CODE`) ; **non défini, la création est fermée** après le
premier — l'absence de configuration ferme la porte, elle ne l'ouvre pas.

**Chaque compte porte un pseudo unique** (`pseudo`, depuis `V27`) : 3 à 24
caractères, lettres (accents compris), chiffres, `.`, `-`, `_` ; ni espace ni
arobase, et il commence par une lettre ou un chiffre. C'est le seul nom sous
lequel quelqu'un apparaît — l'adresse e-mail sert à se connecter, jamais à se
montrer. L'unicité est posée en base sur `lower(pseudo)`, donc insensible à la
casse ; `AuthService` la vérifie AUSSI avant d'écrire, non par redondance mais
pour pouvoir dire « Ce pseudo est déjà pris » plutôt que de laisser remonter
une violation d'index. Et contrairement à un échec de connexion, ce refus est
explicite : un pseudo est public par destination.

Trois détails qui ont coûté du temps, et qu'il vaut mieux lire que
redécouvrir :

- **Le jeton CSRF part dans un cookie lisible** (`XSRF-TOKEN`), que le client
  renvoie en en-tête `X-XSRF-TOKEN`. Le gestionnaire par défaut de Spring
  Security masque ce jeton (protection BREACH) et rejette la valeur brute du
  cookie : toute écriture partait en 403, connexion comprise. D'où le
  `CsrfTokenRequestAttributeHandler` explicite dans `SecurityConfig`.
- **Un 404 passe par une redirection interne vers la page d'erreur**, qui
  retraverse la chaîne de sécurité depuis Spring Security 6. Sans
  `dispatcherTypeMatchers(ERROR).permitAll()`, un lien de partage inconnu
  répondait 401 à un visiteur anonyme. MockMvc ne rejoue pas cette
  redirection : seul un test sur un vrai serveur le voit
  (`PorteSurUnVraiServeurTest`).
- **Les sessions vivent en mémoire** : un redémarrage déconnecte tout le monde.
  Assumé — se reconnecter après une mise à jour coûte moins qu'un magasin de
  sessions à administrer.

### Le schéma multi-utilisateur (option B, posée dès la V2)

`ownership`, `experience` et `wishlist_entry` portent une colonne `owner_id`
depuis `V2__add_owner_id.sql`, rejointes depuis par `tier_list`, `entity_rank`,
`followed_edition`, `collector_preferences` et `share_settings`. Le `Catalog`
(Entity/Variant/Relationship/Tag) reste volontairement **partagé** : une œuvre
est la même pour tout le monde, seules les possessions et les envies sont
privées.

`V25__app_user.sql` ajoute la table des comptes, `V26` complète les trois
tables privées qui n'avaient pas encore de `owner_id` (analyses d'achat, prix
relevés, appartenance à un classement), et `V27` fait du nom d'affichage un
**pseudo** : colonne renommée, valeurs réparées (celles qui recopiaient une
adresse e-mail), doublons départagés, puis index unique.

### L'isolation, et pourquoi elle ne vit pas dans les requêtes

Chaque table privée porte une colonne `owner_id` annotée **`@TenantId`** :
Hibernate l'ajoute au `WHERE` de toute requête sur l'entité et la remplit à
l'insertion, depuis `ProprietaireCourant`. L'alternative - un `ownerId` en
paramètre des quatre-vingts appels de dépôt - aurait surtout laissé une règle à
se rappeler à chaque requête écrite plus tard. Une seule oubliée, et un écran
montre la collection de quelqu'un d'autre sans que rien ne le signale.

**Sans compte connu, le propriétaire vaut `PERSONNE`** (voir `DefaultOwner`),
un identifiant qu'aucun compte ne porte : un chemin qui oublierait de dire au
nom de qui il travaille ne voit **rien**. Se tromper doit faire voir rien,
jamais la collection du premier compte.

**Deux trous que `@TenantId` ne bouche pas**, découverts par le test
d'isolation et à connaître avant d'écrire un dépôt :

- `findById` de JPA charge **par clé primaire, sans requête** : pas de filtre,
  donc la ligne d'un autre compte remonte. D'où les `findOneById` dérivés dans
  les dépôts JPA - qui sont, eux, des requêtes.
- `deleteById` et les suppressions **en masse** (`deleteBy…`) ont le même
  angle mort, et il coûte plus cher : elles effaçaient les lignes d'un autre
  compte. Toutes passent désormais par une lecture filtrée, puis une
  suppression de ce qui a été trouvé.

**Le seul franchissement légitime** est le lien de partage : son destinataire
n'a pas de compte, et ce qu'il doit voir appartient à quelqu'un d'autre. Il
passe par `AuNomDe.executer(proprietaire, …)`, écrit en toutes lettres dans
`PublicShareController`.

## Renommer le projet

3 endroits à modifier, indépendants les uns des autres :

1. **`pom.xml`** — `<groupId>` et `<artifactId>` (lignes 14-15) : purement
   cosmétique côté Maven, aucun impact sur le code Java.
2. **Noms des services Docker** — `iozycore-api` dans `docker-compose.yml`
   et `docker-compose.synology.yml` : Compose ne permet pas de
   paramétrer le nom d'un service via `.env` (seulement ses valeurs), donc
   c'est un remplacement direct dans ces 2 fichiers (recherche/remplace
   simple, 2-3 occurrences par fichier).
3. **Le package Java `com.iozycore`** (69 fichiers) — si tu veux aussi
   renommer le package lui-même, **utilise le "Rename Package" de ton IDE**
   (IntelliJ, Eclipse, VS Code + extension Java) plutôt qu'un
   chercher-remplacer manuel : c'est une opération de refactoring vérifiée
   par le compilateur, qui met à jour tous les `package`/`import` d'un coup
   sans rien casser. Un remplacement texte brut sur 69 fichiers serait
   fragile et risquerait de casser des chaînes de caractères qui contiennent
   "iozycore" sans rapport avec le package (ex: les noms de colonnes SQL,
   volontairement non affectés par ce genre de renommage).

## Structure du code

- `domain/` — les 4 agrégats métier (Entity, Ownership, Experience,
  WishlistEntry), aucune dépendance à Spring/JPA.
- `application/` — orchestration des cas d'usage (ex : `QuickAddService`).
- `infrastructure/persistence/` — implémentation JPA des ports du domaine.
- `api/` — contrôleurs REST.
- `src/test/` — tests unitaires (domaine) et d'intégration (Testcontainers).

Document de conception complet : voir `../docs/CONCEPTION.md`.
