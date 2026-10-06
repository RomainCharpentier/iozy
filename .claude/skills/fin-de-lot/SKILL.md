---
name: fin-de-lot
description: Procédure de fin de lot : vérification en direct sur données jetables, retour à l'état d'avant, section du journal de migration, commit.
disable-model-invocation: true
---

# Fin de lot

1. **Vérifier en direct** sur des données jetables, avec retour à l'état exact d'avant. Ne touche pas à la vraie collection.
   - Écran connecté avec des données : pile e2e gardée (`IOZYCORE_E2E_GARDER_LA_PILE=1 npm run test:e2e`) + `web-e2e` (`.claude/launch.json`, :5174 vers API :8090) + session Playwright rejouée.
   - Le navigateur intégré ne compose aucune image : vérifie par la mesure (`getBoundingClientRect`, `read_page`, texte), pas par capture.
   - Écrans : mobile (390×844) et bureau (1280×900), thèmes sombre et clair.
2. **Piège des analyses d'achat** : une analyse jetable laisse une trace dans `market_price_observation` (supprimable par `DELETE /api/purchase-analysis/market-observations/{id}`). Compte la table avant et après, sinon les analyses de vérification se servent de comparables les unes aux autres.
3. **Journal** : ajoute une section dans `docs/DESIGN_MIGRATION_V1.2.md` (en français).
4. **Commit** : utilise le skill `commit`.
