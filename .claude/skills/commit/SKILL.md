---
name: commit
description: Prépare et crée un commit Conventional Commits en anglais, après avoir lancé les vérifications du dossier touché.
disable-model-invocation: true
---

# Commit

1. `git status` et `git diff` : un commit = une intention. S'il y a un `fix` et un `feat` mélangés, ou un `refactor` et un changement de comportement, scinde en plusieurs commits.
2. Lance la suite complète du dossier touché avant de commiter :
   - `web/` : `npm test`, `npm run typecheck`, `npm run lint` (plus `npm run check:contrast` si une couleur a bougé, `npm run check:deploiement` si nginx ou le Dockerfile ont bougé).
   - `backend/` : suite complète via le skill `test-backend`. Si des paquets ont bougé, `ModulesTest` d'abord.
3. Branche : le propriétaire commite sur `main`. Pour tout le reste, une branche, jamais de push forcé.
4. Message, **en anglais simple** (sujet comme corps) :

```
type(scope): subject

body (optional)

Co-Authored-By: <la ligne imposée par la session>
```

- **Type** : `feat` (comportement nouveau pour l'utilisateur), `fix` (livré mais défaillant), `refactor` (structure, pas de comportement), `perf`, `test`, `docs` (docs, READMEs, CLAUDE.md seuls), `chore`, `ci`, `style`, `revert`.
- **Portée** (optionnelle, un mot en minuscules sans accent, ou deux séparés par une virgule) : couche (`web`, `api`, `e2e`, `ui`, `web,api`) ou fonctionnalité (`fiche`, `import`, `recognition`, `purchase-analysis`, `tomes`, `editions`, `catalogue`, `gemini`, `visite`, `metadonnees`, `listing`, `profil`). Réutilise une portée existante : `git log --format=%s | grep '(fiche)'`. Pas de portée si le changement est transversal.
- **Sujet** : impératif, sans point final, minuscule au début, ~65 caractères (plafond ~100). Dis ce que ça change pour l'utilisateur ou le système, pas les fichiers touchés.
- **Corps** (si non trivial) : le pourquoi d'abord, puis ce qui a été fait, puis ce qui a été vérifié (`typecheck, lint, N tests and build green`).
- Les messages d'avant la règle sont en français : ne les réécris pas (ni rebase, ni `--amend` sur du déjà poussé).
