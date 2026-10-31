---
paths:
  - "iozykit/**"
---

# IozyKit

- `css/tokens.css` est **généré** par `npm run build` à partir de `tokens.json` : change `tokens.json`, jamais le CSS à la main.
- `npm test` = build + contraste AA des paires de couleurs. Il réécrit `css/tokens.css` en LF : si git le montre modifié sans changement de valeur, remets-le en CRLF.
- Les deux apps prennent le kit par `file:` : après un changement, relance leurs contrôles (`npm run check` à la racine).
- Un composant du kit (`.iozy-barre`, `.iozy-apps`…) se documente dans `CHARTE.md`. Le mot-marque s'écrit Iozy**Core**, Iozy**Play** (deux majuscules).
