# Outillage

Rien ici ne fait partie du produit : aucune app ne dépend de ce dossier, et
les images Docker l'ignorent (`.dockerignore` à la racine).

- `claude-lab/` : projet d'entraînement à l'API Claude (examen CCDV-F), données
  inventées. `npm ci && npm test` dans le dossier.
- `nomik/` : la configuration de Nomik, le graphe de code (`nomik.config.ts`,
  pointé sur la racine du dépôt), et le `docker-compose.yml` de son Neo4j local.
  Se lance depuis ce dossier.
