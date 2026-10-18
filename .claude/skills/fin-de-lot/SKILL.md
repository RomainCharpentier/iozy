---
name: fin-de-lot
description: Clôt un lot : e2e, vérification en direct, journal, revue de code, commit, push. Termine en conseillant de vider la conversation.
disable-model-invocation: true
---

# Fin de lot

1. **E2E** (si le lot touche `iozycore/web/` ou l'API qu'il appelle) : `npm run test:e2e` depuis `iozycore/web/`. Lis le résultat. Si le lot crée ou change un parcours d'écran, ajoute ou étends un `e2e/*.spec.ts` (règles dans `web/CLAUDE.md`, section Tests).
2. **Vérification en direct** sur des données jetables, avec retour à l'état exact d'avant. Méthode dans `iozycore/web/CLAUDE.md` (« Vérifier l'interface dans le navigateur de l'app »). Piège : une analyse d'achat jetable laisse une ligne dans `market_price_observation` ; compte la table avant et après.
3. **Journal** : une section dans `docs/DESIGN_MIGRATION_V1.2.md`.
4. **Revue** : lance `/code-review` sur le diff du lot. Corrige les défauts de **correction** ou d'exigence non tenue ; ignore le reste (style, abstractions en plus), il pousse à sur-concevoir.
5. **Commit** : lance le skill `commit`.
6. **Push** : `git push` juste après le commit (sur `main` si c'est le propriétaire, sinon `git push -u origin <branche>`). Jamais de push forcé. Un push sur `main` déclenche le déploiement : dis-le dans la conclusion.
7. **Conclusion** : dis que le lot est clos et poussé et conseille `/clear` avant le suivant. Ne vide pas la conversation toi-même.
