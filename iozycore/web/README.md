# IozyCore — App Web

## Le projet

IozyCore est une base de connaissances personnelle, auto-hébergée, où
**chaque personne a sa collection** (depuis le 2026-08-29 ; le catalogue des
œuvres, lui, est commun) : cataloguer une collection (mangas, jeux vidéo, jeux de
société, types personnalisés), suivre ce qu'on possède indépendamment de ce qu'on a vécu (lu,
joué, terminé, avec note et commentaire), enrichi automatiquement via des
API publiques gratuites. Ce dossier est le client Web (React) ; le backend
(Spring Boot) est dans `../backend`. Le client iOS (`../ios`) est hors
service depuis le 2026-08-29 : le Web est le client vivant.

Document de conception complet : `../../docs/CONCEPTION.md`. Ce README
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
                      auth/  collection/ (+ category/)  entity/ (+ apercu/)
                      add/  scan/  import-photo/  discover/  tier-lists/ (+ board/)
                      purchase-analysis/ (+ history/)
                      profile/ (+ administration/, import/, import-bgg/)
                      suggestions/  releases/  recap/  stats/  editions/
                      share/  entity-types/ (+ form/)  not-found/
    common/         ce qui est partagé par plusieurs pages, et rien d'autre
                      components/   le design system (Carte, Chip, Jaquette, GrilleVolumes…)
                                    et layout/ (AppShell, en-têtes, barre d'onglets)
                      hooks/        useAuth, useWishlist, useModalA11y, useDocumentTitle…
                      lib/          règles et utilitaires (queryKeys, invalidations, retour,
                                    texte, préférences, jaquettes)
                      api/          client HTTP + un module par ressource du backend
                      types/        les DTO miroir du backend
                      theme/        dégradés, icônes, avatars
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
plutôt que du style en dur, et les classes Tailwind de `src/index.css`
(`bg-surface`, `text-textDim`, `text-accent`, `font-display`...) pour rester
visuellement cohérent avec le reste de l'app. Une route de plus dans
`app/App.tsx`, et c'est tout.

**Changer une couleur** : les deux thèmes viennent de la charte de la famille
Iozy (IozyKit), installée comme paquet `iozykit` épinglé sur un commit dans
`package.json` (`github:RomainCharpentier/IozyKit#<sha>` ; `package-lock.json`
dit lequel). Rien du kit n'est copié dans ce dépôt. `src/index.css` ne fait
que relier les noms de l'app aux variables `--iozy-*` du kit ; seuls les rôles
que le kit n'a pas (couleurs d'univers, échelle des rangs, voiles) y gardent
leurs deux thèmes. Une couleur de la charte se change dans `tokens.json` du
kit, `npm test` là-bas (contraste), push, puis on avance le sha dans
`package.json` et `npm install`.

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
mérite un parcours, ce n'est pas une règle - les tests Vitest la couvrent
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
`../backend/src/main/java/com/iozycore/core/api/config/CorsConfig.java`), ces
requêtes échouent en 403 "Invalid CORS request" - constaté en testant la
création d'un type depuis le build Docker (`:8081`, absent de la liste au
départ, seul `:5173` y était). Toute nouvelle origine servant cette app
(nouveau port, domaine de prod) doit être ajoutée côté backend.

### État actuel

Le Web est **le client vivant** : le client iOS est hors service depuis le
2026-08-29 (voir `../ios/README.md`). La navigation a **trois entrées**, qui ne
nomment aucun univers : **Ma collection** (`/`), **Ajouter** et la recherche
(`/add`), **Découvrir** (`/discover`).

Les autres écrans s'atteignent depuis ces trois-là :
- la collection par catégorie (`/collection/:entityTypeId`), la fiche d'une
  œuvre (`/entity/:id`) avec ses possessions, expériences, tags et relations,
  les éditions (`/editions`) ;
- **Envies** et **Suivre** sont des états d'une œuvre, à côté de « possédé » ;
  `/wishlist` ne fait que rediriger vers la collection filtrée ;
- le calendrier des sorties (`/releases`), les suggestions (`/suggestions`),
  les statistiques (`/stats`) et le bilan (`/recap`) ;
- les classements (`/tier-lists`) et l'analyse d'une annonce
  (`/purchase-analysis`, avec son historique) ;
- l'ajout rapide avec suggestions de métadonnées, le scan de code-barres par
  caméra (`/scan`) et l'import de l'étagère depuis une photo (`/import-photo`) ;
- l'éditeur de types de collection (`/types`), le profil (`/profile`, avec
  l'import BGG et l'import de collection) et l'administration
  (`/administration`, réservée à l'administrateur) ;
- la page d'un lien de partage (`/public/share/:token`), sans compte.

Volontairement pas construit : un cache hors-ligne des données. TanStack Query
sert de cache mémoire pendant la session, mais rien n'est persisté (voir la
section PWA : le service worker ne met en cache que la coquille, jamais
`/api`). Le scan par caméra utilise `BarcodeDetector` (Chrome, Edge, Android) ;
Safari et Firefox retombent sur la saisie manuelle de l'ISBN.

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
- `npm run typecheck` — TypeScript seul, sans build (`tsc -b --noEmit`). **`npx tsc --noEmit`
  ne vérifie rien** ici : le `tsconfig.json` racine n'a que des références
- `npm run lint` — oxlint
- `npm test` — la suite Vitest, une fois (`npm run test:watch` pour itérer)
- `npm run test:e2e` — les parcours de bout en bout (Playwright). Démarre sa
  **propre pile Docker** (base + API sur `:8090`), joue les parcours, éteint
  tout, volumes compris. Rien à lancer avant, rien à nettoyer après.
  `npm run test:e2e:ui` ouvre l'interface de Playwright.
- `npm run check:frontieres` — vérifie les règles d'import entre pages et `common`
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
`8081`), `docker-compose.synology.yml` (prod, sous-domaine Traefik
séparé de l'API - voir ce fichier pour le détail) et `docker-compose.nas.yml`
(NAS, à partir d'images publiées). Ces fichiers sont dans `../backend/`.
