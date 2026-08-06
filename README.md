# IozyCore — Guide de démarrage

Ce guide réunit en un seul endroit tout ce qu'il faut pour lancer et tester
IozyCore : le backend (API + base de données) et l'app iOS. Les deux
dossiers (`backend/` et `ios/`) ont chacun leur propre README plus
détaillé sur leur partie ; celui-ci sert de point d'entrée et de check-list.

Pour reprendre le projet en profondeur (architecture, conventions de code,
comment ajouter une fonctionnalité) — humain ou IA — chaque README a une
section "Le projet" en tout début de fichier, pensée pour ça spécifiquement.
Ce guide-ci reste volontairement pratique (lancer/tester), pas architectural.

## Vue d'ensemble

```
┌─────────────────┐      HTTP       ┌──────────────────┐      SQL      ┌────────────┐
│   App iOS        │ ───────────▶   │  API Spring Boot  │ ───────────▶  │ PostgreSQL │
│ (Xcode/simulateur)│  localhost:8080│  (Docker)          │                │ (Docker)   │
└─────────────────┘                 └──────────────────┘                └────────────┘
                                              │
                                              ▼
                                     Jikan / BGG (APIs publiques)
```

Le backend peut être testé **seul** (via Swagger UI ou `requests.http`,
sans aucune app cliente). L'app iOS a besoin du backend lancé pour
fonctionner (elle appelle `http://localhost:8080/api`).

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

**Vérifier que ça tourne :**
```bash
curl http://localhost:8080/api/entities/00000000-0000-0000-0000-000000000000
# 404 attendu -> l'API répond bien
```

### Tester

| Méthode | Ce que c'est | Comment |
|---|---|---|
| **Swagger UI** | Interface web pour tester chaque route à la main | Ouvrir `http://localhost:8080/swagger-ui.html` |
| **`requests.http`** | 21 requêtes prêtes à l'emploi (ajout rapide + déduplication, recherche métadonnées, lookup ISBN, import BGG, recherche transversale, statistiques, découverte, wishlist, suppression bloquée...) | Extension "REST Client" (VS Code) ou client HTTP intégré (IntelliJ/DataGrip), clic sur "Send Request" |
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

## Partie 2 — App iOS

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
12. Toujours dans Stats, "Voir des suggestions" : mangas du même auteur ou
    jeux tendance BGG en commun apparaissent — "Ajouter" les intègre direct.

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
- **IGDB** (métadonnées jeux vidéo) n'est pas branché — nécessite un compte
  développeur Twitch à créer soi-même.
- Le **lookup par code-barres** ne couvre que les mangas (ISBN, via Open
  Library) — les jeux vidéo/société utilisent des codes-barres UPC/EAN,
  hors du périmètre d'Open Library ; le scan y pré-remplit juste le code brut.
- Pas d'**authentification** (JWT) sur les appels réseau — cohérent avec le
  choix mono-utilisateur strict de la conception, à ajouter si l'app doit un
  jour être exposée au-delà du réseau local. Le schéma de base est déjà
  préparé pour ça (`owner_id` sur les possessions/expériences/wishlist,
  Catalog partagé) sans que ce soit encore exploité.
- L'app Web (React) n'existe pas encore — prévue en V2 dans la roadmap.
- Aucun environnement de CI n'est configuré — les tests se lancent
  manuellement pour l'instant (commande `docker run ... mvn test`).

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
