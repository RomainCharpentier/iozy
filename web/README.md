# IozyCore — App Web

## Le projet

IozyCore est une base de connaissances personnelle, auto-hébergée et
mono-utilisateur : cataloguer une collection (mangas, jeux vidéo, jeux de
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
    api/            client HTTP (client.ts) + un module par ressource
                     (entities.ts, ownerships.ts, experiences.ts, wishlist.ts,
                     tags.ts, relationships.ts, insights.ts, metadata.ts)
    types/          api.ts (DTOs miroir camelCase du backend, dont EntityTypeDto),
                     entityTypes.ts (constantes domaine-wide non liées à un type -
                     CONDITIONS, RELATIONSHIP_TYPE_PRESETS... - plus les 3 types
                     eux-mêmes, désormais dynamiques via api/entityTypes.ts)
    theme/          tokens.ts (couleurs/dégradés), gradient.ts (hash déterministe
                     pour les tuiles de "couverture", pas d'images réelles)
    components/     design system réutilisable : CoverTile, Chip, StatCard,
                     StatusPill, ErrorBanner, layout/AppShell + TabBar
    routes/         un dossier par écran (Shelf, Search, QuickAdd, EntityDetail,
                     Wishlist, Stats, EntityTypes - gestion des types), 1 page
                     + sous-composants chacun
    lib/            useDebouncedValue, queryKeys (clés TanStack Query centralisées)
```

Chaque écran suit le même patron que le client iOS : une page publique par
route, des sous-composants dans le même dossier pour ses sections/formulaires
(voir `routes/EntityDetail/` comme référence la plus complète : TagsSection,
OwnershipsSection, ExperiencesSection, RelationshipsSection).

### Comment travailler sur ce projet

**Ajouter un appel API** : dans le module `api/<domaine>.ts` pertinent (ou
en créer un nouveau si le domaine n'existe pas encore), jamais directement
dans un composant de page. Les types de requête/réponse vont dans
`types/api.ts` — mêmes noms de champs en camelCase que les DTO Java du
backend (Jackson et JSON s'accordent nativement dessus).

**Ajouter un écran** : nouveau dossier sous `routes/`, réutilise les
composants de `components/` (`Chip`/`CoverTile`/`StatCard`/`StatusPill`)
plutôt que du style en dur, et les tokens de `theme/tokens.ts` (ou les
classes Tailwind générées depuis `src/index.css` : `bg-surface`,
`text-textDim`, `text-accent`, `font-display`...) pour rester visuellement
cohérent avec le reste de l'app et avec le client iOS.

**Écrire un test** : Vitest + Testing Library, dans un `*.test.ts(x)` posé
**à côté du module qu'il vérifie** — pas dans un dossier `__tests__` à part,
pour qu'un module et ses règles se déplacent ensemble. `src/test/fixtures.ts`
construit les objets du serveur (`oeuvre`, `tome`, `possession`, `edition`)
afin qu'un test ne nomme que ce qui le concerne. Ce qui mérite un test ici,
c'est une **règle qui se casse en silence** : un total inconnu qu'on ne doit
pas deviner, un seul signal par carte, une phrase qui promet quelque chose à
l'utilisateur. Les composants se vérifient par le **texte lu à l'écran**,
jamais par une classe CSS ou un `data-testid`.

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
- `npm run check:contrast` — vérifie que tous les couples de couleurs des deux
  thèmes tiennent le 4.5:1 de WCAG AA

## Déploiement (Docker)

`Dockerfile` (build Node → build de prod servi par nginx) et `nginx.conf`
(sert les fichiers statiques + proxy `/api` en interne vers le service
`iozycore-api`, fallback SPA vers `index.html` pour les routes client-side
comme `/entity/:id`). Utilisé par `docker-compose.yml` (dev local, port
`8081`) et `docker-compose.synology.yml` (prod, sous-domaine Traefik
séparé de l'API - voir ce fichier pour le détail).
