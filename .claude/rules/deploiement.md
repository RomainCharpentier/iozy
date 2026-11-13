---
paths:
  - "iozycore/web/nginx.conf"
  - "**/Dockerfile"
  - "**/docker-compose*.yml"
  - ".github/workflows/*.yml"
---

# Déploiement

- Une seule adresse : `/` accueil, `/core/` IozyCore, `/test/` IozyTest, `/api/` l'API. Le nginx d'IozyCore route tout.
- Après un changement ici : `docker compose up --build -d` dans `iozycore/backend/`, puis `npm run check:deploiement http://localhost:8081` dans `iozycore/web/` (15 contrôles).
- L'image web se construit depuis `iozycore/web` (le kit est une dépendance épinglée sur un tag) ; celle d'IozyTest depuis le clone voisin `../iozytest` (son propre dépôt depuis le 2026-11-13). Sous Git Bash, `IOZYCORE_BASE_PATH=/core` demande `MSYS_NO_PATHCONV=1`, sinon `/core` devient un chemin Windows.
- Les noms d'images GHCR sont écrits en dur dans le workflow : change-les aux deux endroits (workflow et compose du NAS).
- On ne déploie pas, on reste en local : après la fusion sur `main`, regarde seulement les jobs de contrôle de la CI, pas la publication des images.
