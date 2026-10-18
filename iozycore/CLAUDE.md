# IozyCore

Base de connaissances personnelle, auto-hébergée, pour cataloguer une collection (mangas, jeux vidéo, jeux de société, types personnalisés). Chaque compte a sa collection ; le catalogue des œuvres est partagé.

Ce dossier est IozyCore, une app du monorepo de la famille Iozy : `backend/` (Spring Boot, la référence), `web/` (React, le client vivant), `ios/` (SwiftUI, **hors service** depuis le 2026-08-29), `design_handoff_v2/` (maquettes). Les règles communes à la famille (langue, dépôt public, git, façon de travailler, comment vérifier) sont dans `../CLAUDE.md` ; `backend/` et `web/` ont chacun leur `CLAUDE.md` : lis celui du dossier où tu travailles.

## Où chercher

- `README.md` : lancer et tester IozyCore (pratique, pas architectural) ; `../README.md` pour la famille.
- `backend/README.md`, `web/README.md` : section « Le projet » en tête, pensée pour reprendre le code.
- `../docs/CONCEPTION.md` : vision et modèle. Le code fait foi en cas de divergence.
- `../docs/DESIGN_MIGRATION_V1.2.md` : journal des lots de l'interface web.
- `../docs/DEPLOIEMENT.md`, `EXPLOITATION.md`, `USER_JOURNEYS.md`, `LISTING_RECOGNITION.md`, `LISTING_SOURCES.md`.
- `design_handoff_v2/` : maquettes de référence du design.

## Règles propres à IozyCore

- **Sources de métadonnées légitimes seulement** : pas de site de scans, même en secours. Mangacollec sert à vérifier les éditions françaises, pas de source pour l'app.
- **Aucun fournisseur n'est indispensable** : chaque écran a un secours, et l'app dit quand elle l'utilise. Une panne de fournisseur ne fait jamais échouer une recherche.
- **Les migrations Flyway livrées ne bougent plus**, pas même un commentaire (la somme de contrôle changerait).
- **Fin de lot** : skill `/fin-de-lot`. Piège : une analyse d'achat jetable laisse une trace dans `market_price_observation` ; compte la table avant et après.

## Architecture en une minute

Le backend est un **modulith DDD** : un cœur (`core`) et quatre univers (`manga`, `videogame`, `boardgame`, `custom`). Un univers dépend du cœur, jamais l'inverse, jamais d'un autre univers. Le cœur expose des points d'extension que les univers implémentent. `ModulesTest` (Spring Modulith) vérifie ces frontières à chaque build.

Sécurité : l'API demande une session (cookie), sauf connexion, état de l'instance et liens de partage. Les données privées sont filtrées par propriétaire par `@TenantId` (Hibernate), pas dans les requêtes. Détails dans `backend/CLAUDE.md`.
