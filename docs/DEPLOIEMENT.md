# Déployer IozyCore

Deux chemins, et **le premier ne coûte rien** si tu as déjà un NAS. Chaque
étape dit **comment vérifier** qu'elle a marché avant de passer à la suivante.

> Ce document ne déploie pas à ta place : la création des comptes et la saisie
> des secrets se font avec tes identifiants, chez toi.

| | Coût | Pour qui |
|---|---|---|
| **A · NAS Synology** (ci-dessous) | rien | tu as déjà le NAS, tes données restent chez toi |
| **B · Vercel + Railway** (plus bas) | Railway est payant depuis 2026 | pas de machine à soi |

---

# A · Sur un NAS Synology

L'application a été pensée pour ça : auto-hébergée, une seule machine, tes
données chez toi. Le dépôt porte deux fichiers pour ce cas.

## Traefik, ou le reverse proxy de DSM ?

`docker-compose.synology.yml` embarque **Traefik** et gère Let's Encrypt tout
seul - mais il réclame les ports **80 et 443**, que DSM occupe déjà. Il faut
donc déplacer les ports de DSM, ce qui touche à l'accès au NAS lui-même.

Le chemin le plus simple est l'inverse : **le reverse proxy de DSM devant le
`docker-compose.yml` ordinaire**. DSM garde 80/443, gère les certificats
Let's Encrypt dans son interface, et l'application n'expose qu'un port local.
C'est ce qui suit.

## 1. Le domaine

Control Panel → **External Access** → **DDNS** : un nom en `.synology.me`
suffit, il est gratuit et le certificat suivra.

**Vérifier** : le nom résout vers ton IP publique, et les ports **80 et 443**
sont redirigés vers le NAS sur ta box. Let's Encrypt a besoin du 80.

## 2. Les conteneurs

Copier le dépôt sur le NAS, puis créer `backend/.env` :

```
DB_PASSWORD=un-mot-de-passe-long
WEB_ALLOWED_ORIGINS=https://ton-nom.synology.me
SESSION_COOKIE_SECURE=true
```

Puis, dans **Container Manager** (ou en SSH depuis `backend/`) :

```bash
docker compose up -d --build
```

> **Attention si la base existe déjà.** `DB_PASSWORD` ne change QUE ce que
> l'API présente ; le mot de passe réel a été fixé à la **première**
> initialisation du volume et n'en bouge plus. Changer la variable sur une base
> déjà créée donne `password authentication failed`. Aligner l'existant :
>
> ```bash
> docker exec -e PGPASSWORD=<ancien> <conteneur-postgres> \
>   psql -U iozycore -d iozycore -c "ALTER USER iozycore WITH PASSWORD '<nouveau>';"
> ```

**Vérifier** : `http://<ip-du-nas>:8081` affiche l'écran de connexion.

> **Après tout `--force-recreate` de l'API, redémarrer `web`.** nginx résout
> le nom `iozycore-api` **au démarrage** et garde l'ancienne adresse : l'API
> répond 200 en direct sur :8080 pendant que :8081 rend 502. Un
> `docker compose restart web` suffit.

## 3. Le reverse proxy de DSM

Control Panel → **Login Portal** → **Advanced** → **Reverse Proxy** → *Create* :

| | |
|---|---|
| Source | HTTPS · `ton-nom.synology.me` · port **443** |
| Destination | HTTP · `localhost` · port **8081** |

Un seul enregistrement suffit : nginx, dans le conteneur `web`, achemine déjà
`/api` vers l'API en interne. Le navigateur ne voit **qu'une seule origine** -
exactement ce que le cookie de session suppose (voir « Pourquoi la réécriture »
plus bas).

Puis Control Panel → **Security** → **Certificate** → *Add* → **Let's
Encrypt**, pour ce même nom, et *Configure* pour l'assigner au reverse proxy.

**Vérifier** :

```bash
cd web && npm run check:deploiement https://ton-nom.synology.me
```

Onze contrôles, tous en GET, aucun compte requis.

## 4. Le premier compte

Identique au chemin B : voir **« 4. Le premier compte »** plus bas - il est
administrateur d'office, exige un pseudo, et reprend la collection déjà en
base.

## Ce que ce chemin ne fait pas

Il **n'ouvre pas** l'API sur un sous-domaine séparé : Swagger et l'accès direct
restent sur le réseau local (`:8080`). C'est volontaire - une surface de moins
sur Internet, et l'app web n'en a pas besoin. `docker-compose.synology.yml` le
fait, si tu veux ce sous-domaine et que tu acceptes de déplacer les ports DSM.

---

# B · Vercel (app) + Railway (API et base)

> **Railway n'a plus d'offre gratuite** depuis 2026 : son essai expire et
> demande un plan payant. Ce chemin reste décrit parce qu'il vaut pour tout
> hébergeur qui sert du Docker, mais si tu as un NAS, prends le chemin A.

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
annonce ses 28 migrations. Si la réponse est un 502, c'est le contrôle de santé :
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

Le créer **depuis l'app**. Trois choses le distinguent de tous les suivants :

- il **reprend l'identifiant du propriétaire par défaut**, donc toute donnée
  déjà présente en base lui appartient (sur une base neuve, il n'y a rien à
  reprendre — c'est le cas normal ici) ;
- il est **administrateur d'office** (voir la migration V28) : sans lui,
  personne ne pourrait ouvrir l'écran d'administration ;
- il n'a **pas besoin de code d'invitation**, contrairement aux suivants.

Trois champs : adresse, mot de passe (**10 caractères minimum**), et **pseudo**
— 3 à 24 caractères, lettres (accents compris), chiffres, `.`, `-`, `_`, sans
espace ni arobase. Le pseudo est **unique sur l'instance** et **ne se change
pas** : c'est le seul nom sous lequel tu apparais, et il donne aussi les
initiales et la couleur de l'avatar.

**Vérifier** : après création, on arrive sur « Ma collection », l'avatar en haut
à droite porte tes initiales, et le bouton clé (Administration) mène à
« Comptes ». Puis, dans un onglet privé, ouvrir la même URL : l'écran de
connexion doit apparaître, et
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

Ce qui est **partagé et administré** : les catégories de collection, les
éditions de référence et les **tags**. Un compte ordinaire les lit, seul un
administrateur les pose. Le second compte n'est donc pas administrateur — le
devenir se fait en SQL, délibérément :

```sql
UPDATE app_user SET is_admin = true WHERE lower(pseudo) = 'le-pseudo';
```

Et **on ne supprime pas son propre compte** : c'est ce qui garantit qu'il reste
toujours quelqu'un pour administrer l'instance.

---

## Tout vérifier d'un coup

```
cd web && npm run check:deploiement https://<ton-app>.vercel.app
```

Onze contrôles, tous en GET, aucun compte requis - le script ne laisse rien
derrière lui et peut se relancer à tout moment, y compris sur une mise en ligne
qui sert déjà des gens :

| ce qu'il regarde | ce qu'un échec signifie |
|---|---|
| `/api/auth/etat` répond 200, en JSON, avec les deux drapeaux attendus | la réécriture `/api/*` ne part pas vers l'API — c'est le repli SPA qui a répondu, en HTML, avec un 200 parfaitement trompeur |
| `/api/entities/search` refuse en **401** | 200 : la porte est ouverte. 404 : la réécriture ne couvre pas toutes les routes, et ça ne se verrait qu'une fois connecté |
| un jeton de partage inventé répond **404**, pas 401 | le destinataire d'un lien n'a pas de compte : un 401 lui demanderait de se connecter pour voir une collection qui n'est pas la sienne (défaut réel du Lot 94) |
| le manifeste sort en `application/manifest+json` | l'invite d'installation disparaît, sans un message ; le type vient du serveur, pas du fichier |
| `sw.js` interdit la mise en cache | les visiteurs restent sur l'ancienne coquille, parfois des jours, sans moyen de le savoir |
| `/tier-lists` rend du HTML en 200 | pas de repli SPA : l'app marche tant qu'on navigue et casse au premier F5 ou au premier lien partagé |

Les mêmes contrôles valent sur la pile Docker locale
(`npm run check:deploiement http://localhost:8081`) : c'est là qu'ils ont été
mis au point, et ils y ont immédiatement trouvé un conteneur nginx périmé qui
servait encore la configuration d'avant les règles PWA - manifeste en
`text/html`, `sw.js` sans en-tête de cache. Exactement le genre d'écart que la
page, elle, ne montre pas.

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
