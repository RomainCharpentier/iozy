---
name: fin-de-lot
description: Clôt un lot en quatre temps : e2e, vérification en direct, journal, commit. Termine en conseillant de vider la conversation.
disable-model-invocation: true
---

# Fin de lot

1. **E2E** (si le lot touche `web/` ou l'API qu'il appelle) : `npm run test:e2e` depuis `web/`. Lis le résultat. Si le lot crée ou change un parcours d'écran, ajoute ou étends un `e2e/*.spec.ts` (règles dans `web/CLAUDE.md`, section Tests).
2. **Vérification en direct** sur des données jetables, avec retour à l'état exact d'avant. Méthode dans `web/CLAUDE.md` (« Vérifier l'interface dans le navigateur de l'app »). Piège : une analyse d'achat jetable laisse une ligne dans `market_price_observation` ; compte la table avant et après.
3. **Journal** : une section dans `docs/DESIGN_MIGRATION_V1.2.md`.
4. **Commit** : lance le skill `commit`.
5. **Conclusion** : dis que le lot est clos et conseille `/clear` avant le suivant. Ne vide pas la conversation toi-même.
