# Iozy

IozyCore et le site des apps Iozy : des apps personnelles, auto-hébergées, servies à une seule adresse. IozyTest ([dépôt](https://github.com/RomainCharpentier/iozytest)) et IozyKit ([dépôt](https://github.com/RomainCharpentier/IozyKit)) ont chacun leur dépôt depuis le 2026-11-13.

| Dossier | Ce que c'est | Où ça vit sur le site |
|---|---|---|
| `iozycore/` | **IozyCore**, le catalogue de collection : mangas, jeux vidéo, jeux de société, ce qu'il te manque et ce que vaut une annonce. Backend Spring Boot, client web React, app iOS (hors service). | `/core/` (et `/api/`) |
| `docs/` | Déploiement, exploitation, conception, journal des lots. | — |
| `tools/` | Outillage personnel, hors produit : lab d'entraînement à l'API Claude, graphe de code Nomik. | — |

La racine du site, `/`, est la page d'accueil ; dans chaque app, la marque en haut à gauche ouvre le menu pour passer à l'autre.

## Lancer tout en local

Docker Desktop, et IozyTest cloné à côté de ce dépôt (la pile le construit depuis `../iozytest`) :

```bash
git clone https://github.com/RomainCharpentier/iozytest.git ../iozytest
```

Puis :

```bash
cd iozycore/backend && docker compose up --build
```

- http://localhost:8081/ : la page d'accueil
- http://localhost:8081/core/ : IozyCore (API sur :8080)
- http://localhost:8081/test/ : IozyTest

Depuis la racine, `npm run up` lance la même pile en arrière-plan et `npm run check` lance les contrôles du web d'IozyCore (après un `npm ci` dans `iozycore/web`).

Pour développer avec rechargement à chaud, lis `iozycore/README.md` (le guide de démarrage complet d'IozyCore) ; IozyTest et IozyKit ont le leur dans leur dépôt.

## Mettre en ligne et faire tourner

`docs/DEPLOIEMENT.md` (sur un NAS Synology, ou chez un hébergeur) et `docs/EXPLOITATION.md` (démarrer, arrêter, lire une panne, sauvegarder). À chaque push sur `main`, GitHub Actions teste IozyCore et publie ses deux images (`iozycore-api`, `iozycore-web`).

## Reprendre le code

Chaque dossier a son `CLAUDE.md` (conventions, pièges, comment vérifier) et son README avec une section « Le projet ». Les règles communes sont dans `CLAUDE.md` à la racine. Les trois dépôts d'origine ont été réunis le 2026-10-17 en gardant leur historique : `git log` suit chaque fichier jusqu'à sa naissance.
