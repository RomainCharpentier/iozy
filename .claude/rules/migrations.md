---
paths:
  - "iozycore/backend/src/main/resources/db/migration/*.sql"
---

# Migrations Flyway

- Nom d'une migration : `V{n}__description.sql`.
- **Ne modifie jamais une migration déjà livrée**, pas même un commentaire : la somme de contrôle changerait. Pour corriger, ajoute une nouvelle migration `V{n+1}__description.sql`. Le hook `.claude/hooks/guard.mjs` bloque l'édition d'une migration déjà commitée.
- Une colonne de plus demande quatre changements ensemble : la migration, le `{Xxx}JpaEntity`, le mapper de l'adaptateur et le DTO.
