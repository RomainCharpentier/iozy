# IozyCore — Guide de démarrage

Ce guide réunit en un seul endroit tout ce qu'il faut pour lancer et tester
IozyCore : le backend (API + base de données), l'app iOS et l'app Web. Les
trois dossiers (`backend/`, `ios/`, `web/`) ont chacun leur propre README
plus détaillé sur leur partie ; celui-ci sert de point d'entrée et de
check-list.

Pour reprendre le projet en profondeur (architecture, conventions de code,
comment ajouter une fonctionnalité) — humain ou IA — chaque README a une
section "Le projet" en tout début de fichier, pensée pour ça spécifiquement.
Ce guide-ci reste volontairement pratique (lancer/tester), pas architectural.

**Pour mettre l'app en ligne** : `docs/DEPLOIEMENT.md` — sur un NAS Synology
(gratuit, l'app a été pensée pour ça) ou chez un hébergeur. Chaque étape y dit
comment vérifier qu'elle a marché avant de passer à la suivante.

**Pour la faire tourner ensuite** — démarrer, arrêter, lire une panne,
sauvegarder : `docs/EXPLOITATION.md`, écrit pour se passer entièrement de la
ligne de commande.

## Vue d'ensemble

```
┌─────────────────┐      HTTP
│   App iOS        │ ──────────────┐
│ (Xcode/simulateur)│               │
└─────────────────┘               ▼
                          ┌──────────────────┐      SQL      ┌────────────┐
                          │  API Spring Boot  │ ───────────▶  │ PostgreSQL │
                          │  (Docker)          │                │ (Docker)   │
                          └──────────────────┘                └────────────┘
┌─────────────────┐               ▲                   │
│   App Web         │ ──────────────┘                   ▼
│ (Vite, :5173)      │  localhost:8080          Jikan / BGG (APIs publiques)
└─────────────────┘  (proxy /api en dev)
```

Le backend peut être testé **seul** (via Swagger UI ou `requests.http`,
sans aucune app cliente). L'app iOS et l'app Web ont chacune besoin du
backend lancé pour fonctionner (elles appellent `http://localhost:8080/api`,
directement pour l'iOS, via le proxy de dev Vite pour le Web — voir
`web/README.md`).

---

## Partie 1 — Backend

### Prérequis

**Uniquement Docker + Docker Compose.** Rien d'autre à installer pour lancer
l'API et la tester.

### Lancer

```bash
cd backend
docker compose up --build
```

Premier lancement : 1-2 minutes (téléchargement des images + build Maven).
Les suivants sont quasi instantanés. La base PostgreSQL est initialisée
automatiquement (migrations Flyway), avec les 3 types du MVP déjà en place.
Cette même commande lance aussi un build de l'app web sur
`http://localhost:8081` (voir Partie 3, Option B) — si tu veux juste tester
l'API seule, ignore ce port.

**Vérifier que ça tourne :**
```bash
curl http://localhost:8080/api/auth/etat
# {"aucunCompte":true,"creationOuverte":true} -> l'API répond bien
```

### Le premier compte

Depuis le 2026-08-29, **l'API demande un compte** : sans session, tout répond
401, sauf trois choses — l'état ci-dessus, la connexion, et les liens de
partage (dont le destinataire n'a par définition pas de compte).

Le plus simple est de créer ce premier compte **depuis l'app web** : ouvre-la,
elle propose « Créer un compte » tant que personne n'en a. Ce premier compte
**reprend la collection déjà en base** — rien à migrer.

En ligne de commande, si tu testes l'API seule :
```bash
curl -X POST http://localhost:8080/api/auth/register -H 'Content-Type: application/json' -d '{"email":"moi@example.com","motDePasse":"un-mot-de-passe","pseudo":"moi"}'
```

Le **pseudo** est obligatoire et unique sur l'instance : 3 à 24 caractères,
lettres (accents compris), chiffres, `.`, `-`, `_`, sans espace ni arobase.
C'est le seul nom sous lequel quelqu'un apparaît — l'adresse e-mail sert à se
connecter, jamais à se montrer.

Les comptes **suivants** exigent un code d'invitation, à définir dans
l'environnement (`IOZYCORE_INVITE_CODE`). Non défini, la création est **fermée**
après le premier compte : une instance déployée sans y penser ne devient pas
une base ouverte à qui passe.

#### Visiter sans compte

L'écran de connexion propose **« Visiter sans compte »** dès qu'un compte
existe sur l'instance : n'importe qui peut alors parcourir la collection du
**premier compte** — les fiches, les classements, les statistiques — sans rien
créer et sans que personne ait à l'autoriser.

C'est une **lecture seule**, et pas seulement à l'affichage : une session de
visite se voit refuser toute requête autre qu'un `GET`, quelle que soit la
route (voir `SecurityConfig`). Les écrans d'écriture — ajout, scan, analyse
d'annonce, administration — ne lui sont même pas proposés.

**Ouvert par défaut**, et c'est le point à peser : sans lien ni jeton à
distribuer, la collection est lisible par **qui atteint l'application** — donc
par tout Internet si l'instance y est exposée. Pour refermer, décoche
« Ouverte aux visiteurs » dans **Profil → Partage** ; l'accès est repris
immédiatement, y compris pour les visites déjà en cours.

C'est **indépendant du lien de partage**, qui reste la bonne réponse quand on
veut montrer une sélection à quelqu'un en particulier : supprimer le lien ne
referme pas la porte, et l'ouvrir ne crée aucun jeton.

### Tester

| Méthode | Ce que c'est | Comment |
|---|---|---|
| **Swagger UI** | Interface web pour tester chaque route à la main | Ouvrir `http://localhost:8080/swagger-ui.html` — **connecte-toi d'abord** (le navigateur garde le cookie de session, Swagger en profite) |
| **`requests.http`** | 25 requêtes prêtes à l'emploi (ajout rapide + déduplication, recherche métadonnées, lookup ISBN, import BGG, recherche transversale, statistiques, découverte, wishlist, suppression bloquée...) | Extension "REST Client" (VS Code) ou client HTTP intégré (IntelliJ/DataGrip), clic sur "Send Request" |
| **curl** | Ligne de commande | Voir exemples dans `requests.http` ou le README backend |

### Lancer les tests automatisés

Sans installer Java ni Maven (juste Docker) :

```bash
docker run --rm \
  -v "$(pwd)":/build -w /build \
  -v /var/run/docker.sock:/var/run/docker.sock \
  maven:3.9-eclipse-temurin-21 mvn test
```

Couvre : tests unitaires du domaine (invariants des agrégats), tests
d'intégration Testcontainers (vrai PostgreSQL jetable), tests du parsing
Jikan/BGG (fixtures, pas d'appel réseau réel).

### Arrêter

```bash
docker compose down       # garde les données
docker compose down -v    # repart à zéro
```

---

## Obtenir et configurer un token BGG (optionnel, mais recommandé)

Sans ce token, la recherche BGG, l'import de collection et la découverte de
jeux de société **fonctionnent quand même** pour tester en local — mais ne
sont pas conformes aux conditions d'utilisation actuelles de BGG (obligatoires
depuis juillet 2025 pour presque tout usage de leur API). Voici comment
l'obtenir et le brancher, étape par étape.

### 1. Créer un compte BGG (si tu n'en as pas déjà un)

Sur [boardgamegeek.com](https://boardgamegeek.com), en haut à droite,
"S'inscrire" / "Sign Up". Gratuit.

### 2. Enregistrer une application

1. Une fois connecté, va sur
   [boardgamegeek.com/applications](https://boardgamegeek.com/applications).
2. Clique sur "Register Application" (ou va directement sur
   [boardgamegeek.com/applications/create](https://boardgamegeek.com/applications/create)).
3. Remplis le formulaire :
   - **Application Name** : ce que tu veux, ex. `IozyCore`.
   - **Description** : une phrase suffit, ex. "Personal collection tracker for my own use".
   - **Lien web (optionnel)** : laisse vide si tu n'as rien à mettre.
   - **Type de licence** : choisis **"Non-commercial"** — c'est le bon choix
     pour un usage personnel comme IozyCore (gratuit).
4. Envoie le formulaire.

### 3. Attendre l'approbation

BGG traite les demandes manuellement. Compte **de quelques jours à environ
une semaine**. Aucune action de ton côté en attendant — l'app IozyCore
fonctionne normalement pendant ce temps (juste sans token).

### 4. Générer le token une fois approuvé

1. Retourne sur [boardgamegeek.com/applications](https://boardgamegeek.com/applications).
2. Ton application approuvée apparaît dans la liste — clique sur
   "Tokens" à côté de son nom.
3. Génère un token. Il ressemble à ça :
   `e3f8c3ff-9926-4efc-863c-3b92acda4d32`
4. Copie-le (il ne sera pas ré-affiché en clair indéfiniment — note-le
   quelque part de sûr, ex. ton gestionnaire de mots de passe).

### 5. Ajouter le token au projet

Dans le dossier `backend/` :

1. Si ce n'est pas déjà fait, copie `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
2. Ouvre `.env` et renseigne la ligne :
   ```
   BGG_APPLICATION_TOKEN=e3f8c3ff-9926-4efc-863c-3b92acda4d32
   ```
   (remplace par ton vrai token).
3. Relance le backend pour qu'il prenne la variable en compte :
   ```bash
   docker compose up --build
   ```

**Vérifier que ça marche :** relance une recherche BGG (`requests.http`,
requête 11) ou un import de collection (requête 14) — plus aucun message
`WARN` mentionnant l'absence de token dans les logs du conteneur
(`docker compose logs iozycore-api`).

---

## Obtenir et configurer des identifiants IGDB/Twitch (requis pour les jeux vidéo)

IGDB (métadonnées et découverte pour les jeux vidéo) appartient à Twitch et
s'authentifie via son flux OAuth2 client-credentials. **Contrairement à
BGG, il n'y a pas de mode dégradé** : sans ces identifiants, la recherche
et la découverte jeux vidéo renvoient simplement une liste vide — le reste
de l'app fonctionne normalement.

### 1. Créer un compte Twitch (si tu n'en as pas déjà un)

Sur [twitch.tv](https://www.twitch.tv), en haut à droite, "S'inscrire".
Gratuit.

### 2. Enregistrer une application

1. Une fois connecté, va sur
   [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) et
   clique sur "Register Your Application".
2. Remplis le formulaire :
   - **Name** : ce que tu veux, ex. `IozyCore`.
   - **OAuth Redirect URLs** : `http://localhost` (le flux
     client-credentials ne redirige jamais réellement vers cette URL,
     mais Twitch exige d'en renseigner une).
   - **Category** : "Application Integration".
3. Valide (une vérification par captcha/téléphone peut être demandée par
   Twitch selon ton compte).

### 3. Récupérer Client ID et générer un Client Secret

1. Ton application enregistrée apparaît dans
   [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) —
   clique dessus.
2. Le **Client ID** est affiché directement.
3. Clique sur "New Secret" pour générer le **Client Secret** (affiché une
   seule fois — note-le quelque part de sûr, ex. ton gestionnaire de mots
   de passe).

### 4. Ajouter les identifiants au projet

Dans le dossier `backend/` :

1. Si ce n'est pas déjà fait, copie `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
2. Ouvre `.env` et renseigne :
   ```
   IGDB_CLIENT_ID=ton_client_id
   IGDB_CLIENT_SECRET=ton_client_secret
   ```
3. Relance le backend pour qu'il prenne les variables en compte :
   ```bash
   docker compose up --build
   ```

**Vérifier que ça marche :** dans l'app (iOS ou Web), onglet Ajouter, type
"Jeu vidéo", tape un titre — des suggestions IGDB doivent apparaître après
un court instant. Ou en ligne de commande :
```bash
curl "http://localhost:8080/api/metadata/search?entityTypeId=00000000-0000-0000-0000-000000000002&query=zelda"
```

---

## Obtenir et configurer un Client ID MyAnimeList (optionnel, recommandé)

Jikan (utilisé pour la recherche manga) est un wrapper tiers non-officiel :
il doit lui-même se reconnecter à MyAnimeList à chaque requête, et
MyAnimeList le bloque/throttle par intermittence - ça se manifeste par des
pannes `504` où la recherche manga ne renvoie plus rien pendant un moment
(temporaire, mais imprévisible et hors de notre contrôle). Un Client ID
MyAnimeList permet d'utiliser l'**API officielle** en complément de Jikan
(jamais à sa place) : elle prend le relais automatiquement quand Jikan est
indisponible.

### 1. Créer un compte MyAnimeList (si tu n'en as pas déjà un)

Sur [myanimelist.net](https://myanimelist.net), "Sign Up". Gratuit.

### 2. Créer un Client ID

1. Une fois connecté, va sur
   [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig).
2. Clique sur "Create ID".
3. Remplis le formulaire :
   - **App Name** : ce que tu veux, ex. `IozyCore`.
   - **App Type** : `web`.
   - **App Redirect URL** : `http://localhost` (jamais réellement utilisée
     pour la recherche publique, mais le formulaire l'exige).
   - **Homepage URL** : laisse vide si tu n'as rien à mettre.
   - **App Description** : une phrase suffit, ex. "Personal collection
     tracker for my own use".
4. Envoie le formulaire.

### 3. Récupérer le Client ID

Contrairement à BGG, **pas d'attente d'approbation manuelle** : le Client ID
est affiché immédiatement sur la page de ton application, une fois créée.
Pas de Client Secret à générer non plus - un Client ID suffit pour la
recherche publique.

### 4. Ajouter le Client ID au projet

Dans le dossier `backend/` :

1. Si ce n'est pas déjà fait, copie `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
2. Ouvre `.env` et renseigne la ligne :
   ```
   MAL_CLIENT_ID=ton_client_id
   ```
3. Relance le backend pour qu'il prenne la variable en compte :
   ```bash
   docker compose up --build
   ```

**Vérifier que ça marche :** dans l'app (iOS ou Web), onglet Ajouter, type
"Manga", tape un titre - si Jikan est aussi up, tu peux voir des
suggestions des deux sources (`JIKAN` et `MYANIMELIST`) pour un même titre,
c'est normal (les deux sont agrégées, jamais l'une à la place de l'autre).

---

## Partie 2 — App iOS

> **Hors service depuis le 2026-08-29.** L'API demande une session, ce client
> n'en ouvre aucune : tous ses appels reçoivent 401. Ce qu'il faudrait pour le
> remettre en marche (trois points, plus courts qu'il n'y paraît) et les trois
> issues possibles sont détaillés dans `ios/README.md` et dans
> `docs/AUDIT_TECHNIQUE.md`, constat C4. La décision n'est pas technique.

Direction visuelle : fond sombre, accent vert-jaune vif, grille de
couvertures en dégradé plutôt que des listes système (façon
Letterboxd/Spotify). Étape optionnelle mais recommandée avant de lancer :
voir `IozyCore/Fonts/README.md` pour ajouter les polices custom (Space
Grotesk + Inter, 5 minutes) - sans elles, l'app tourne quand même, juste
avec la police système en repli.

### Prérequis

- Mac + **Xcode** (15+, pour iOS 17/SwiftData).
- **XcodeGen** : `brew install xcodegen` (une fois).
- Le **backend doit déjà tourner** (Partie 1) avant de lancer l'app.
- Un **iPhone physique** uniquement si tu veux tester le scan de
  code-barres (pas de caméra sur le simulateur).

### Lancer

```bash
cd ios
xcodegen generate
open IozyCore.xcodeproj
```

Dans Xcode : choisir un simulateur iPhone, cliquer sur **Run** (▶).

### Tester le flux complet (backend + iOS ensemble)

1. Backend lancé (`docker compose up --build`).
2. App iOS lancée sur le simulateur.
3. Onglet **Ajouter** : taper "Death Note" → des suggestions Jikan
   apparaissent après ~1 seconde → en choisir une pré-remplit le titre et
   les attributs (auteur, éditeur) → **Ajouter**.
4. Onglet **Étagères** : le manga apparaît immédiatement.
5. Taper dessus → la fiche récupère ses Ownership/Experience depuis l'API.
6. "Ajouter une expérience" → note + commentaire → **Enregistrer** :
   l'appel `POST /api/experiences` passe réellement, avec validation
   serveur du type contre l'`EntityType`.
7. Onglet **Recherche** : taper "Death Note" → résultat remonté par une
   vraie recherche sur ta collection côté serveur (UC4, pas juste un filtre
   du cache local) → confirme "Déjà possédé" au tap.
8. Onglet **Ajouter**, icône scanner (iPhone physique requis) : scanne le
   code-barres ISBN au dos d'un manga → l'app interroge Open Library et
   pré-remplit titre + attributs automatiquement si l'ISBN est reconnu
   (sinon le code brut reste affiché). Pour un jeu vidéo/société, le scan
   pré-remplit toujours juste le code brut (pas de source ISBN équivalente
   pour ces types, voir limites ci-dessous).
9. Dans la fiche détail, "Gérer les tags" pour créer/associer un tag, et
   "Ajouter une relation" pour lier deux éléments de ta collection entre eux.
10. Onglet **Étagères**, icône d'import : entre un pseudo BoardGameGeek
    public, lance l'import — les jeux "possédés" de cette collection
    apparaissent dans les Étagères après quelques secondes.
11. Onglet **Stats** : vérifie que les compteurs reflètent ce qui vient
    d'être ajouté (total, par type, note moyenne).
12. Toujours dans Stats, "Voir des suggestions" : mangas du même auteur,
    jeux tendance BGG en commun, ou jeux vidéo similaires (IGDB, si des
    identifiants sont configurés) apparaissent — "Ajouter" les intègre direct.
13. Onglet **Étagères**, icône "Gérer les types" : crée un type personnalisé
    (ex: "Films", champ personnalisé "réalisateur") — il apparaît aussitôt
    dans le picker de l'onglet Ajouter et les filtres des Étagères.

---

## Partie 3 — App Web

Client React pour tester la collection depuis un PC, sans simulateur Xcode.
Mêmes parcours que l'iOS (voir `web/README.md` pour le détail), plus une
Wishlist réellement fonctionnelle (l'endpoint de liste manquait côté
backend - ajouté à cette occasion, partagé avec l'iOS).

### Lancer

**Option A — avec rechargement à chaud (dev)** :
```bash
# Prérequis : Node.js (18+) et npm, backend déjà lancé (Partie 1)
cd web
npm install
npm run dev
```
Ouvre `http://localhost:5173`. Le serveur de dev proxy les appels `/api`
vers `http://localhost:8080` (voir `web/vite.config.ts`) — pas de config
CORS à faire pour développer en local.

**Option B — build de prod, sans installer Node** : le service `web` est
maintenant inclus dans `docker compose up --build` (Partie 1) — ouvre
directement `http://localhost:8081`. nginx sert le build statique et
proxy `/api` en interne vers le backend (voir `web/nginx.conf`), donc pas
de rechargement à chaud mais aucune installation locale requise.

### Tester le flux complet (backend + Web ensemble)

1. Backend lancé (`docker compose up --build`).
2. App Web lancée (`npm run dev` dans `web/`).
3. Onglet **Ajouter** : taper "Death Note" → suggestions Jikan → en choisir
   une pré-remplit titre + attributs → **Ajouter**.
4. Onglet **Étagères** : le manga apparaît immédiatement.
5. Cliquer dessus → la fiche récupère Ownership/Experience/Tags/Relations
   depuis l'API. "Ajouter une expérience" → note + commentaire →
   **Enregistrer**.
6. Onglet **Recherche** : taper "Death Note" → résultat remonté par la
   recherche transversale côté serveur → "Vérifier" confirme "Possédé".
7. Onglet **Recherche** sur un titre pas encore possédé → "Vérifier" →
   "Ajouter à la wishlist" → onglet **Wishlist** : le titre y apparaît.
8. Onglet **Stats** : les compteurs reflètent ce qui vient d'être ajouté ;
   "Voir des suggestions" propose des mangas/jeux (et jeux vidéo via IGDB,
   si des identifiants sont configurés) à ajouter en un clic.
9. Bouton "Gérer les types" (écran Étagères) : crée un type personnalisé
   (ex: "Films", champ personnalisé "réalisateur") — il apparaît aussitôt
   dans le sélecteur de l'onglet Ajouter et les filtres des Étagères.

---

## Renommer le projet

Backend et iOS ont chacun un point de départ documenté pour ça (section
"Renommer le projet"/"Renommer l'app" de leur README respectif) : côté iOS,
un seul fichier (`Config.xcconfig`) à modifier ; côté backend, 2-3 endroits
ciblés selon jusqu'où tu veux aller (nom Maven, noms des services Docker,
et le package Java si tu veux aussi renommer ça via ton IDE).

## Limites connues (assumées, pas des oublis)

- **Token BGG requis pour un usage conforme** : depuis juillet 2025, BGG
  exige un enregistrement d'application + un token Bearer pour la quasi-
  totalité de son API (recherche, collection, découverte). Sans lui, ces
  fonctionnalités continuent de marcher pour tester en local, mais ne
  respectent pas les conditions actuelles de BGG — voir "Obtenir et
  configurer un token BGG" plus haut pour la marche à suivre complète.

- **Import BGG** ne récupère que les jeux marqués "possédés" (`own=1`) —
  pas la wishlist BGG, pas les notes/stats, pas les images (l'endpoint de
  recherche BGG utilisé par ailleurs n'en fournit pas non plus).
- **Identifiants IGDB/Twitch requis** : contrairement à BGG, pas de mode
  dégradé — sans `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`, la recherche et la
  découverte jeux vidéo renvoient simplement une liste vide (voir "Obtenir
  et configurer des identifiants IGDB/Twitch" plus haut).
- Le **lookup par code-barres** ne couvre que les mangas (ISBN, via Open
  Library) — les jeux vidéo/société utilisent des codes-barres UPC/EAN,
  hors du périmètre d'Open Library ; le scan y pré-remplit juste le code brut.
- **Éditeur de types dynamique** : les champs personnalisés
  (`customFieldKeys`) restent purement descriptifs, rien ne valide côté
  serveur qu'une Entity respecte les champs déclarés par son type. Le
  lookup code-barres, l'import BGG et la découverte restent câblés sur les
  3 codes historiques (`MANGA`/`BOARD_GAME`/`VIDEO_GAME`) — un type créé
  par l'utilisateur n'a accès à aucun de ces trois, intrinsèquement liés à
  des API externes spécifiques.
- **L'authentification vit désormais dans l'application** (depuis le
  2026-08-29) : comptes, session en cookie, et chaque compte cloisonné sur sa
  propre collection. Tout demande une session, Swagger compris ; restent
  ouvertes la connexion, l'état de l'instance, et les liens de partage
  (`/public/*`, `/api/public/*`) dont le jeton fait office de mot de passe.
  Voir `backend/README.md` (« Comptes et session », « L'isolation ») et
  `docs/DEPLOIEMENT.md`.

  Le HTTP Basic de Traefik (`BASIC_AUTH_USERS`) a été **retiré** le
  2026-08-30 : il protégeait une application qui n'avait aucune
  authentification en propre. Il était devenu une seconde demande de mot de
  passe devant la première — et il cassait les liens de partage, dont le
  destinataire est censé n'avoir rien à saisir. `docker-compose.synology.yml`
  porte désormais deux routeurs Traefik au lieu de quatre : les exceptions de
  chemin n'ont plus lieu d'être puisqu'il n'y a plus de porte à contourner.
- Le sous-domaine Traefik de l'app Web dans `docker-compose.synology.yml`
  (`app.iozycore.mondomaine.tld`) est un exemple à adapter à ton propre
  domaine/DDNS, comme celui de l'API — voir "Renommer le projet" plus haut
  pour l'équivalent côté API.
- Le **scan de code-barres par caméra** de l'app Web (`/scan`) repose sur
  l'API navigateur `BarcodeDetector` (Shape Detection API) : disponible sur
  Chrome/Edge desktop et Android, absente de Safari et Firefox, où l'écran
  annonce clairement le repli sur la saisie manuelle de l'ISBN. L'app Web n'a
  par ailleurs pas de **cache hors-ligne** persistant (contrairement au cache
  SwiftData de l'iOS) — pensée pour tester avec le backend lancé, pas pour un
  usage nomade.

## En cas de problème

- **`docker compose up` échoue au build** : vérifier que Docker Desktop
  tourne et a assez de mémoire allouée (4 Go minimum recommandé).
- **L'app iOS n'arrive pas à joindre l'API** : vérifier que
  `docker compose up` est bien lancé et que `curl http://localhost:8080/...`
  répond depuis le Mac. Le simulateur iOS partage le réseau du Mac, donc
  `localhost` fonctionne tel quel — pas besoin de trouver une IP.
- **`xcodegen: command not found`** : `brew install xcodegen`, puis relancer
  `xcodegen generate`.
- **Les tests Testcontainers échouent** : vérifier que le socket Docker est
  bien monté (`-v /var/run/docker.sock:/var/run/docker.sock`) et que Docker
  tourne sur la machine hôte.
- **La recherche/l'import BGG ne renvoie rien, ou les logs affichent
  `Aucun bgg.application-token configuré`** : normal sans token (voir
  "Obtenir et configurer un token BGG") — le token n'est vérifié qu'au moment
  de l'appel, pas au démarrage, donc si tu viens de l'ajouter à `.env`,
  vérifie que `docker compose up --build` a bien redémarré le conteneur.
- **La recherche/découverte jeux vidéo renvoie toujours une liste vide** :
  normal sans identifiants IGDB (voir "Obtenir et configurer des
  identifiants IGDB/Twitch") — contrairement à BGG, aucun message `WARN`
  n'apparaît par défaut tant que la fonctionnalité n'est pas appelée.
- **Créer/modifier un type (ou toute autre action d'écriture) échoue en
  403 "Invalid CORS request" depuis l'app Web** : l'origine du navigateur
  n'est pas dans `WEB_ALLOWED_ORIGINS` côté backend (voir
  `api/config/CorsConfig.java`) — par défaut seuls `localhost:5173` (dev
  Vite) et `localhost:8081` (build Docker local) sont autorisés ; en
  déploiement Synology, définir cette variable avec le vrai domaine du
  service web dans `.env`.
