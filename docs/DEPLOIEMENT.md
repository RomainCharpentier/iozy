# Déployer IozyCore — Vercel (app) + Railway (API et base)

Ce document est une **procédure**, pas une présentation : chaque étape a ce
qu'il faut faire, et **comment vérifier** qu'elle a marché avant de passer à la
suivante. Établi le 2026-08-29, en préparant les fichiers de configuration que
le dépôt porte désormais (`web/vercel.json`, `backend/railway.json`).

> Ce que ce document ne fait pas : déployer à ta place. La création des comptes
> et la saisie des secrets se font avec tes identifiants, chez toi.

---

## Le montage, en une phrase

L'app est servie par Vercel, qui **réécrit `/api/*` vers l'API Railway**. Le
navigateur ne voit donc **qu'une seule origine** — exactement ce que le reste du
projet suppose déjà : le proxy Vite en développement et le nginx du build Docker
font la même chose, et le cookie de session en dépend (voir « Pourquoi la
réécriture » plus bas).

```
Navigateur ──► Vercel  ──/api/*──►  Railway (API Spring Boot) ──► Railway Postgres
               (app web,            (Dockerfile du dépôt)
                PWA, service
                worker)
```

---

## 1. La base de données

Sur Railway : **New Project → Provision PostgreSQL**.

Rien à configurer. Note dans un coin que Railway expose les variables `PGHOST`,
`PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` — l'étape suivante les
référence.

**Vérifier** : le service Postgres est vert, et l'onglet *Data* montre une base
vide.

---

## 2. L'API

Toujours dans le même projet Railway : **New → GitHub Repo**, ce dépôt, puis
dans les réglages du service :

- **Root Directory** : `backend`
- **Builder** : Dockerfile (déjà déclaré par `backend/railway.json`, qui pose
  aussi le contrôle de santé sur `/api/auth/etat` — une des trois routes
  ouvertes, donc lisible sans compte).

### Les variables

| Variable | Valeur | Pourquoi |
|---|---|---|
| `DB_HOST` | `${{Postgres.PGHOST}}` | référence Railway, jamais une valeur recopiée |
| `DB_PORT` | `${{Postgres.PGPORT}}` | |
| `DB_NAME` | `${{Postgres.PGDATABASE}}` | |
| `DB_USER` | `${{Postgres.PGUSER}}` | |
| `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` | |
| `SESSION_COOKIE_SECURE` | `true` | il y a du TLS devant : le cookie de session ne doit jamais partir en clair |
| `WEB_ALLOWED_ORIGINS` | l'URL Vercel, ex. `https://iozycore.vercel.app` | même derrière une réécriture, une écriture porte un en-tête `Origin` que Spring vérifie |
| `IOZYCORE_INVITE_CODE` | *(vide au début)* | tant qu'il est vide, **personne** ne peut créer de compte après le premier |

Les clés de fournisseurs (`BGG_APPLICATION_TOKEN`, `IGDB_*`, `MAL_CLIENT_ID`,
`GOOGLE_BOOKS_API_KEY`, `GEMINI_API_KEY`) sont **facultatives** : sans elles,
les fonctionnalités correspondantes s'absentent proprement (voir
`backend/.env.example`, qui dit ce que chacune coupe).

`PORT` est posé par Railway : l'application l'écoute déjà (`server.port` dans
`application.yml`).

> **Ne pas passer à plusieurs répliques.** Les sessions vivent en mémoire (choix
> assumé, voir `SecurityConfig`) : deux instances renverraient les gens à
> l'écran de connexion une requête sur deux, sans erreur nulle part.
> `railway.json` fixe donc `numReplicas: 1`.

**Vérifier** : `https://<ton-api>.up.railway.app/api/auth/etat` répond
`{"aucunCompte":true,"creationOuverte":true}`. Et dans les journaux, Flyway
annonce ses 26 migrations. Si la réponse est un 502, c'est le contrôle de santé :
regarder les journaux avant de toucher à autre chose.

---

## 3. L'app web

Sur Vercel : **Add New → Project**, ce dépôt, **Root Directory `web`**. Le
reste (framework Vite, `npm run build`, sortie `dist`) est déjà déclaré par
`web/vercel.json`.

**Une seule ligne à changer avant le premier déploiement** : dans
`web/vercel.json`, remplacer `REMPLACER-PAR-TON-API.up.railway.app` par le
domaine réel de l'API. Ce n'est pas un secret — c'est une adresse publique, et
la mettre dans le dépôt évite qu'elle vive dans un tableau de bord que personne
ne relit.

**Vérifier** : ouvrir l'URL Vercel. L'écran attendu est **« Créer un compte »**
avec la phrase *« Personne n'a encore de compte ici »* — ce qui prouve du même
coup que la réécriture marche : cet écran vient d'un appel à `/api/auth/etat`.

---

## 4. Le premier compte

Le créer **depuis l'app**. Il reprend l'identifiant du propriétaire par défaut,
donc toute donnée déjà présente en base lui appartient (sur une base neuve, il
n'y a rien à reprendre — c'est le cas normal ici).

**Vérifier** : après création, on arrive sur « Ma collection ». Puis, dans un
onglet privé, ouvrir la même URL : l'écran de connexion doit apparaître, et
`https://<ton-api>.up.railway.app/api/entities/search` doit répondre **401**.

---

## 5. Ouvrir à une seconde personne (facultatif)

Poser `IOZYCORE_INVITE_CODE` sur le service API, avec une valeur que tu
transmets à la main. L'écran de connexion propose alors « Créer un compte avec
une invitation ».

Chaque compte a **sa** collection : le catalogue des œuvres est partagé (une
œuvre est la même pour tout le monde), mais possessions, envies, classements,
analyses et prix relevés sont cloisonnés (voir `backend/README.md`, section
« L'isolation »).

---

## Pourquoi la réécriture, et pas un appel direct à l'API

Parce que la session est un **cookie**. Servir l'app et l'API sous deux domaines
en ferait un cookie *cross-site*, qui exige `SameSite=None` — que Safari et les
navigateurs en navigation privée traitent de moins en moins bien, et qui ouvre
la porte aux écritures déclenchées depuis une autre page. La réécriture garde
une seule origine, `SameSite=Lax`, et zéro configuration CORS côté navigateur.

C'est aussi le montage que le dépôt utilise déjà partout ailleurs : `vite.config.ts`
en développement, `nginx.conf` dans le build Docker. Trois environnements, un
seul comportement.

## Ce qu'il faut savoir avant la première panne

- **Un redémarrage déconnecte tout le monde.** Les sessions sont en mémoire. Un
  déploiement = une reconnexion. C'est le prix assumé de ne pas administrer un
  magasin de sessions.
- **Le service worker sert la coquille de l'app, jamais `/api`.** Une version
  déployée est donc visible dès la visite suivante, et jamais une donnée
  périmée (voir `public/sw.js`).
- **`GET /api/public/share/{token}` reste ouvert**, par construction : c'est le
  lien de partage, dont le destinataire n'a pas de compte. Tout le reste,
  Swagger compris, demande une session.
- **La base est la seule chose irremplaçable.** Railway garde des sauvegardes,
  mais un export régulier depuis l'app (Profil ▸ Paramètres ▸ Administration ▸
  Export, 14 fichiers) coûte deux clics et ne dépend d'aucun hébergeur.
