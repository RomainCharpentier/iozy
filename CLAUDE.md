# Iozy

Un seul dépôt pour trois dossiers de même rang, réunis le 2026-10-17 en gardant leur historique :

- `iozycore/` : IozyCore, le catalogue de collection (backend Spring Boot, client web React, app iOS hors service, maquettes). Son `CLAUDE.md` décrit l'architecture ; lis-le quand tu y travailles.
- `iozyplay/` : IozyPlay, le blindtest (serveur Node + front React). Son `CLAUDE.md`.
- `iozykit/` : la charte graphique commune, dépendance locale des deux apps (`file:` vers ce dossier).
- `docs/` : les documents communs (déploiement, exploitation, conception, journal des lots).
- `tools/` : outillage personnel, hors produit (lab Claude, Nomik). Aucune app n'en dépend.

Le site est une seule adresse : `/` la page d'accueil, `/core/` IozyCore, `/play/` IozyPlay, `/api/` l'API. Le nginx d'IozyCore (`iozycore/web/nginx.conf`) route tout ; `iozycore/backend/docker-compose.yml` lance la pile complète en local.

## Règles qui valent partout

- **Langue** :
  - **En anglais** : le code et tout ce qui s'y rattache (identifiants nouveaux, commentaires, noms de tests, messages de log) et les **messages de commit**. Anglais simple : phrases courtes, mots courants, pas d'idiomes. Exception : `iozyplay/` et `iozykit/` ont gardé leurs commentaires et leurs commits en français ; suis l'usage du dossier.
  - **En français** : **tous les fichiers `.md`**, les **textes que lit l'utilisateur** (libellés, messages, aides) et la discussion avec le propriétaire.
  - Les identifiants existants sont en partie français. **Ne renomme pas en masse** : le nouveau code est en anglais, et en modifiant une ligne existante tu n'anglicises que ce que tu touches déjà.
  - Un nom déjà public ou stocké reste tel quel : une route, une clé d'URL, une colonne livrée. Ne modifie jamais une migration Flyway déjà livrée.
- **Dépôt public** : jamais d'adresse, d'identifiant, de clé ni de réglage d'une installation précise dans un fichier suivi. Les notes personnelles vont dans un fichier `*.local.md` (ignoré par git). Les clés vont dans `iozycore/backend/.env`, jamais dans le code.
- **Consolider plutôt qu'ajouter** : quand le travail n'est pas désigné, choisis dans cet ordre (1) ce qui est livré mais cassé ou incohérent, (2) ce qui est livré mais inatteignable ou muet, (3) ce qui est fragile. N'expose une interface que si la fonctionnalité derrière est réellement branchée.
- **Aucun fournisseur n'est indispensable** : chaque écran a un secours, et l'app dit quand elle l'utilise.

## Vérifier un changement

| Tu as touché | Lance |
|---|---|
| `iozycore/web/` | `npm test`, `npm run typecheck`, `npm run lint` (voir `iozycore/web/CLAUDE.md`) |
| `iozycore/backend/` | un sous-ensemble ciblé de tests (voir `iozycore/backend/CLAUDE.md`) |
| un parcours d'écran | `npm run test:e2e` dans `iozycore/web/` |
| `iozyplay/` | `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:unit` (voir `iozyplay/CLAUDE.md`) |
| `iozykit/` | `npm test` (régénère le CSS et vérifie le contraste AA) |
| plusieurs dossiers | `npm run check` à la racine : kit, IozyCore web, IozyPlay (pas le backend) |
| nginx, Dockerfile, compose | `docker compose up --build` dans `iozycore/backend/`, puis `npm run check:deploiement http://localhost:8081` dans `iozycore/web/` |

Une vérification qui ne s'exécute pas ne vaut rien : plusieurs commandes évidentes ne contrôlent rien ici (`npx tsc --noEmit`, `mvn` sans Docker). Voir les pièges dans chaque sous-dossier.

## Façon de travailler

- **Court et direct** : annonce l'action en une ou deux phrases, puis agis. Quand on te demande « on fait quoi ? », tranche et dis pourquoi. Pose une question seulement si la réponse change vraiment le travail. Le détail technique va dans le message de commit et dans `docs/DESIGN_MIGRATION_V1.2.md`, pas dans le fil.
- **Maquettes à plusieurs planches** : fais trancher le propriétaire **avant** la première ligne de code.
- **« Je ne vois pas de changement »** : vérifie d'abord que le serveur de dev tourne encore. N'accuse pas le cache.
- **Fin de lot** : skill `/fin-de-lot` (vérification en direct sur données jetables avec retour à l'état d'avant, section dans `docs/DESIGN_MIGRATION_V1.2.md`, commit).
- **Éditer des fichiers par script** : la copie de travail mélange LF et CRLF (`core.autocrlf=true`). Normalise pour chercher, réécris avec la fin de ligne d'origine, vérifie le nombre d'occurrences avant de remplacer. Les avertissements « LF will be replaced by CRLF » de git sont du bruit attendu.
- **Commandes Bash longues** : au-delà de ~5 Ko une commande est tronquée sans message clair. Un fichier par appel.

## Git

Le propriétaire peut commiter **directement sur `main`**. Pour tout le reste (autre intervenant, travail expérimental, changement risqué ou à relire), travaille sur une branche et laisse la fusion au propriétaire, par commit de fusion. Ne pousse jamais de force.

Messages de commit : Conventional Commits, `type: subject`, impératif, sans point final, ~65 caractères, terminés par la ligne `Co-Authored-By` que la session impose. **Un commit = une intention.** Le détail est dans le skill `/commit`. Le type décide du numéro de version d'IozyCore (`feat` = mineur, `!` = majeur, le reste = patch ; les commits sous `iozyplay/` ne comptent pas) : voir « Numéro de version » dans `docs/DEPLOIEMENT.md`. IozyPlay porte son propre numéro dans son `package.json`.

L'historique d'avant ces règles est en français : ne le réécris pas (ni rebase, ni `--amend` sur du déjà poussé).
