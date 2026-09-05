# IozyCore — App Web

## Le projet

IozyCore est une base de connaissances personnelle, auto-hébergée, où
**chaque personne a sa collection** (depuis le 2026-08-29 ; le catalogue des
œuvres, lui, est commun) : cataloguer une collection (mangas, jeux vidéo, jeux de
société), suivre ce qu'on possède indépendamment de ce qu'on a vécu (lu,
joué, terminé, avec note et commentaire), enrichi automatiquement via des
API publiques gratuites. Ce dossier est le client Web (React) ; le backend
(Spring Boot) et le client iOS sont dans des dossiers séparés du même dépôt
(`../backend`, `../ios`). Créé pour tester facilement la collection depuis
un PC, sans dépendre d'un simulateur Xcode.

Document de conception complet : `../docs/CONCEPTION.md`. Ce README
documente l'état du code tel qu'il existe.

### Architecture

React + TypeScript + Vite + TanStack Query + React Router, Tailwind CSS v4
pour le style :

```
web/
  src/
    main.tsx        l'amorçage (polices, index.css, montage de App)
    app/            App.tsx : le routeur, les providers, la coquille
    pages/          UNE PAGE = UN DOSSIER, nommé comme son URL ; ses sous-pages en
                    sous-dossiers ; dedans, la page, ses composants, ses hooks, ses
                    tests, sans autre découpage
                      auth/  collection/ (+ category/, a-lire/)  entity/ (+ apercu/)
                      add/  scan/  discover/  tier-lists/ (+ board/)  purchase-analysis/
                      (+ history/)  profile/ (+ administration/, import-bgg/, question/)
                      suggestions/  recap/  stats/  editions/  settings/ (+ import/)
                      share/  entity-types/ (+ form/)  not-found/
    common/         ce qui est partagé par plusieurs pages, et rien d'autre
                      components/   le design system (Carte, Chip, Jaquette, GrilleVolumes…)
                                    et layout/ (AppShell, en-têtes, barre d'onglets)
                      hooks/        useAuth, useWishlist, useModalA11y, useDocumentTitle…
                      lib/          règles et utilitaires (queryKeys, invalidations, retour,
                                    texte, préférences, jaquettes)
                      api/          client HTTP + un module par ressource du backend
                      types/        les DTO miroir du backend
                      theme/        tokens, dégradés, icônes, avatars
    test/           setup Vitest et fixtures
```

Les imports passent par l'alias `@/` (`@/common/api/entities`,
`@/pages/entity/InspecteurFiche`) : un import dit d'où vient une chose, jamais
combien de dossiers la séparent. Deux règles tiennent le rangement (Lot 134) :
**un module utilisé par une seule page vit dans cette page** ; **dès qu'une
seconde page en a besoin, il monte dans `common`**. Une page compose, elle ne
calcule pas : les données dans des hooks, l'affichage dans des composants.

### Comment travailler sur ce projet

**Ajouter un appel API** : dans le module `common/api/<domaine>.ts` pertinent (ou
en créer un nouveau si le domaine n'existe pas encore), jamais directement
dans un composant de page. Les types de requête/réponse vont dans
`common/types/api.ts` — mêmes noms de champs en camelCase que les DTO Java du
backend (Jackson et JSON s'accordent nativement dessus).

**Ajouter un écran** : nouveau dossier sous `pages/`, nommé comme son URL,
réutilise les composants de `common/components/` (`Carte`, `Chip`, `Jaquette`…)
plutôt que du style en dur, et les tokens de `common/theme/tokens.ts` (ou les
classes Tailwind générées depuis `src/index.css` : `bg-surface`,
`text-textDim`, `text-accent`, `font-display`...) pour rester visuellement
cohérent avec le reste de l'app et avec le client iOS. Une route de plus dans
`app/App.tsx`, et c'est tout.

**Écrire un test** : Vitest + Testing Library, dans un `*.test.ts(x)` posé
**à côté du module qu'il vérifie** — pas dans un dossier `__tests__` à part,
pour qu'un module et ses règles se déplacent ensemble. `src/test/fixtures.ts`
construit les objets du serveur (`oeuvre`, `tome`, `possession`, `edition`,
`tag`)
afin qu'un test ne nomme que ce qui le concerne. Ce qui mérite un test ici,
c'est une **règle qui se casse en silence** : un total inconnu qu'on ne doit
pas deviner, un seul signal par carte, une phrase qui promet quelque chose à
l'utilisateur. Les composants se vérifient par le **texte lu à l'écran**,
jamais par une classe CSS ou un `data-testid`.

**Écrire un parcours de bout en bout** : dans `e2e/*.spec.ts`. Ils partent
connectés (la session est ouverte une fois par `compte.setup.ts` et rejouée),
sauf `porte.spec.ts` qui teste justement l'entrée et part anonyme. Un parcours
qui a besoin d'un visiteur ouvre un contexte neuf (`visite.spec.ts`,
`partage.spec.ts`) ; un parcours qui a besoin d'un **second compte** le crée à
l'écran avec le code d'invitation de la pile (`CODE_INVITATION` dans
`e2e/compte.ts`, voir `import.spec.ts`) - le compte de la suite est
l'administrateur, et il ne peut pas se supprimer lui-même. Ce qui
mérite un parcours, ce n'est pas une règle - les 292 tests Vitest la couvrent
déjà - c'est un **passage** : d'un écran au suivant, du clic à la base. Un
formulaire branché sur la mauvaise route ou un cache qu'on oublie d'invalider
ne casse aucune règle : l'écran reste simplement sur l'état d'avant.

La pile de test **n'a aucune clé de fournisseur** : un parcours qui dépendrait
de Jikan ou de Google Books échouerait le jour où ils toussent, pour une raison
qui n'a rien à voir avec l'application. Les parcours passent donc par un type
de collection créé pour l'occasion - sans fournisseur, donc en saisie libre.

Garder la pile debout après un échec, pour aller regarder :

```bash
IOZYCORE_E2E_GARDER_LA_PILE=1 npm run test:e2e
```

**Vérifier qu'un test sert à quelque chose** : casse la règle exprès et
regarde si un test tombe.

```bash
node scripts/mutation.mjs src/pages/collection/shelfTiles.ts "missing <= 3" "missing <= 4"
```

Le script mute **toutes** les occurrences, lance la suite, restaure le fichier
et sort en erreur si rien n'a échoué — c'est-à-dire si cette règle n'est gardée
par rien. Il refuse de conclure quand le texte cherché est introuvable : une
mutation non appliquée se lit exactement comme un test inutile.

**Tous les appels du client passent par une URL relative** (`/api/...`),
jamais une URL absolue vers le backend — en dev, `vite.config.ts` proxy
`/api` vers `http://localhost:8080` ; en prod (Docker), `nginx.conf` fait
la même chose vers le service `iozycore-api`.

**Piège déjà rencontré** : ce proxy rend les requêtes *lecture* (GET)
transparentes pour le navigateur, mais pas les requêtes qui modifient
l'état (POST/PATCH/DELETE) — celles-ci embarquent toujours un header
`Origin`, même en apparence same-origin via un proxy. Sans l'origine
correspondante dans `web.allowed-origins` côté backend (voir
`../backend/src/main/java/com/iozycore/api/config/CorsConfig.java`), ces
requêtes échouent en 403 "Invalid CORS request" - constaté en testant la
création d'un type depuis le build Docker (`:8081`, absent de la liste au
départ, seul `:5173` y était). Toute nouvelle origine servant cette app
(nouveau port, domaine de prod) doit être ajoutée côté backend.

### État actuel

Construit : les 5 onglets (Étagères/Recherche/Ajouter/Wishlist/Stats) + la
fiche détail + l'éditeur de types (`/types`), mêmes parcours que le client
iOS - ajout rapide avec suggestions de métadonnées (Jikan/BGG/IGDB),
recherche transversale avec vérification avant achat, wishlist réellement
fonctionnelle (contrairement au client iOS actuel, voir note ci-dessous),
tags/relations/expériences sur la fiche détail, import BGG, statistiques
et découverte à la demande (mangas/jeux de société/jeux vidéo).

Trois différences volontaires avec l'iOS :
- **Wishlist fonctionnelle** : l'endpoint `GET /api/wishlist` (liste) a été
  ajouté au backend pour cette app web (il n'existait pas, l'onglet
  Wishlist de l'iOS est de fait toujours vide aujourd'hui) - un seul
  changement backend, partagé, plutôt que dupliqué par client.
- **Suivi de "candidat ajouté" en découverte** par `entityId` retourné
  plutôt que par titre (le suivi par titre côté iOS peut se tromper en cas
  de collision).
- **Types d'expérience/champs personnalisés en saisie libre** dans le
  formulaire de création de type, pas en multi-select : aucune liste
  canonique commune n'existe côté backend (chaque type a la sienne), même
  choix que côté iOS.

Volontairement pas construit : scan de code-barres par caméra (saisie
manuelle à la place, cohérent avec un usage desktop), cache
offline/hors-ligne (TanStack Query sert de cache mémoire pendant la
session, mais rien n'est persisté - cet outil est pensé pour tester avec
le backend lancé, pas pour un usage nomade comme l'iOS).

### Installable sur l'écran d'accueil

Depuis le 2026-08-29, le build de production est une **PWA installable** :
`public/manifest.webmanifest` et ses trois icônes sont générés par
`npm run icons` (même dessin que le favicon), et `public/sw.js` est enregistré
depuis `main.tsx` — **uniquement en production**, un cache d'app shell se
mettant en travers du rechargement à chaud en développement.

Le service worker met en cache **la coquille de l'app, jamais `/api`**. Ce
n'est pas un revirement sur le hors-ligne ci-dessus : des données servies
depuis un cache seraient une collection périmée présentée comme la vraie. Sa
raison d'être est l'installation elle-même — un navigateur ne la propose pas
sans gestionnaire `fetch`.

**Deux pièges côté serveur**, tous deux corrigés dans `nginx.conf` et invisibles
en développement (Vite fait ce qu'il faut tout seul) : la table `mime.types` de
nginx n'a **aucune entrée** pour `.webmanifest` (servi en
`application/octet-stream`), et `sw.js` doit sortir en `Cache-Control:
no-cache` — c'est lui qui décide de ce que le navigateur garde, une version
figée continuerait d'appliquer les règles d'un déploiement précédent.

## Lancer

Le backend doit déjà tourner (`cd ../backend && docker compose up --build`
— voir `../README.md`) - cette commande lance d'ailleurs déjà un build de
prod de cette app web sur `http://localhost:8081` (service `web` de
`docker-compose.yml`, voir `Dockerfile`/`nginx.conf`).

Pour développer avec rechargement à chaud à la place :

```bash
cd web
npm install
npm run dev
```

Ouvre `http://localhost:5173`.

## Scripts

- `npm run dev` — serveur de dev avec rechargement à chaud
- `npm run build` — vérification TypeScript + build de production dans `dist/`
- `npm run preview` — sert le build de production en local
- `npm run typecheck` — TypeScript seul, sans build
- `npm run lint` — oxlint
- `npm test` — la suite Vitest, une fois (`npm run test:watch` pour itérer)
- `npm run test:e2e` — les parcours de bout en bout (Playwright). Démarre sa
  **propre pile Docker** (base + API sur `:8090`), joue les parcours, éteint
  tout, volumes compris. Rien à lancer avant, rien à nettoyer après.
- `npm run check:contrast` — vérifie que tous les couples de couleurs des deux
  thèmes tiennent le 4.5:1 de WCAG AA
- `npm run check:pwa` — vérifie que l'app est réellement installable (manifeste,
  icônes présentes et aux dimensions annoncées, service worker en place)
- `npm run check:deploiement <url>` — vérifie une app **déjà en ligne**, depuis
  l'extérieur : la réécriture `/api/*` atteint bien l'API, les routes protégées
  refusent en 401, un lien de partage inconnu répond 404 (et non 401), le
  manifeste sort en `application/manifest+json`, `sw.js` interdit la mise en
  cache, une route profonde rend la coquille. Que des GET, aucun compte requis :
  il ne laisse rien derrière lui. Marche aussi sur la pile Docker locale
  (`http://localhost:8081`).
- `npm run icons` — régénère la marque **et** le manifeste (`public/`)

## Déploiement (Docker)

`Dockerfile` (build Node → build de prod servi par nginx) et `nginx.conf`
(sert les fichiers statiques + proxy `/api` en interne vers le service
`iozycore-api`, fallback SPA vers `index.html` pour les routes client-side
comme `/entity/:id`). Utilisé par `docker-compose.yml` (dev local, port
`8081`) et `docker-compose.synology.yml` (prod, sous-domaine Traefik
séparé de l'API - voir ce fichier pour le détail).
