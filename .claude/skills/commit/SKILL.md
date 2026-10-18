---
name: commit
description: Prépare et crée un commit Conventional Commits en anglais, après avoir lancé les vérifications du dossier touché.
disable-model-invocation: true
---

# Commit

1. `git status` et `git diff` : un commit = une intention. S'il y a un `fix` et un `feat` mélangés, ou un `refactor` et un changement de comportement, scinde en plusieurs commits.
2. Lance la suite complète du dossier touché avant de commiter :
   - `iozycore/web/` : `npm test`, `npm run typecheck`, `npm run lint` (plus `npm run check:contrast` si une couleur a bougé, `npm run check:deploiement` si nginx ou le Dockerfile ont bougé).
   - `iozycore/backend/` : suite complète via le skill `test-backend`. Si des paquets ont bougé, `ModulesTest` d'abord.
3. Branche : le propriétaire commite sur `main`. Pour tout le reste, une branche, jamais de push forcé.
4. Message, **en anglais simple** (sujet comme corps) :

```
type: subject

body (optional)

Co-Authored-By: <la ligne imposée par la session>
```

- **Type** : `feat` (comportement nouveau pour l'utilisateur), `fix` (livré mais défaillant), `refactor` (structure, pas de comportement), `perf`, `test`, `docs` (docs, READMEs, CLAUDE.md seuls), `chore`, `ci`, `style`, `revert`.
- **Portée** : aucune par défaut (`type: subject`). N'en mets une que si elle aide vraiment à retrouver le commit, un mot en minuscules sans accent (`fiche`, `import`, `api`…), en reprenant une portée déjà utilisée : `git log --format=%s | grep '(fiche)'`. Pas de liste à maintenir.
- **Version** : le numéro est déduit du préfixe (`feat` = mineur, `!` ou `BREAKING CHANGE:` = majeur, tout le reste = patch). Le bon type compte donc : voir « Numéro de version » dans `docs/DEPLOIEMENT.md`.
- **Sujet** : impératif, sans point final, minuscule au début, ~65 caractères (plafond ~100). Dis ce que ça change pour l'utilisateur ou le système, pas les fichiers touchés.
- **Corps** (si non trivial) : le pourquoi d'abord, puis ce qui a été fait, puis ce qui a été vérifié (`typecheck, lint, N tests and build green`).
- Les messages d'avant la règle sont en français : ne les réécris pas (ni rebase, ni `--amend` sur du déjà poussé).
