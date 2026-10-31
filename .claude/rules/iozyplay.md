---
paths:
  - "iozyplay/**"
---

# IozyPlay

- Les commentaires du dossier sont en français (usage du dossier). Les textes affichés aussi.
- Sous `/play/`, toute adresse absolue passe par `import.meta.env.BASE_URL`. Le nom de joueur vient du compte Iozy quand quelqu'un est connecté (`src/lib/account`).
- Un seul écouteur `controllerchange` (`src/utils/serviceWorker.ts`) : ne rajoute pas de rechargement ailleurs. Le worker (`public/sw.js`) ne touche à rien hors de son préfixe.
- Lis le **code de sortie** de `npm run test:unit` : « tous les tests passent » peut cacher des rejets non gérés qui font sortir en 1 et casser la CI.
- Pas de vrai réseau dans un test : fournis un `fetch` factice.
