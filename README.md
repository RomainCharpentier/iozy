# Iozy

Les apps Iozy, dans un seul dépôt : des apps personnelles, auto-hébergées, servies à une seule adresse.

| Dossier | Ce que c'est | Où ça vit sur le site |
|---|---|---|
| `iozycore/` | **IozyCore**, le catalogue de collection : mangas, jeux vidéo, jeux de société, ce qu'il te manque et ce que vaut une annonce. Backend Spring Boot, client web React, app iOS (hors service). | `/core/` (et `/api/`) |
| `iozyplay/` | **IozyPlay**, le blindtest entre amis : serveur Node + Socket.IO, front React. | `/play/` |
| `iozykit/` | **IozyKit**, la charte graphique commune : couleurs des deux thèmes, polices, formes, composants de base, marques. Dépendance locale des deux apps. | — |
| `docs/` | Déploiement, exploitation, conception, journal des lots. | — |

La racine du site, `/`, est la page d'accueil ; dans chaque app, la marque en haut à gauche ouvre le menu pour passer à l'autre.

## Lancer tout en local

Docker Desktop, puis :

```bash
cd iozycore/backend && docker compose up --build
```

- http://localhost:8081/ : la page d'accueil
- http://localhost:8081/core/ : IozyCore (API sur :8080)
- http://localhost:8081/play/ : IozyPlay

Depuis la racine, `npm run up` lance la même pile en arrière-plan et `npm run check` enchaîne les contrôles du kit, d'IozyCore et d'IozyPlay (après un `npm ci` dans chacun de leurs dossiers ; pas de workspaces, chaque dossier garde son `package.json`).

Pour développer une app avec rechargement à chaud, lis le README de son dossier : `iozycore/README.md` (le guide de démarrage complet d'IozyCore), `iozyplay/README.md`, `iozykit/README.md`.

## Mettre en ligne et faire tourner

`docs/DEPLOIEMENT.md` (sur un NAS Synology, ou chez un hébergeur) et `docs/EXPLOITATION.md` (démarrer, arrêter, lire une panne, sauvegarder). À chaque push sur `main`, GitHub Actions teste tout et publie trois images (`iozycore-api`, `iozycore-web`, `iozyplay-app`) que le NAS tire tout seul.

## Reprendre le code

Chaque dossier a son `CLAUDE.md` (conventions, pièges, comment vérifier) et son README avec une section « Le projet ». Les règles communes sont dans `CLAUDE.md` à la racine. Les trois dépôts d'origine ont été réunis le 2026-10-17 en gardant leur historique : `git log` suit chaque fichier jusqu'à sa naissance.
