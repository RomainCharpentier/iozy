# IozyCore

Base de connaissances personnelle, auto-hébergée, pour cataloguer une collection (mangas, jeux vidéo, jeux de société, types personnalisés). Chaque compte a sa collection ; le catalogue des œuvres est partagé.

Monorepo : `backend/` (Spring Boot, la référence), `web/` (React, le client vivant), `ios/` (SwiftUI, **hors service** depuis le 2026-08-29). Chaque dossier a son propre `CLAUDE.md` : lis celui du dossier où tu travailles.

## Où chercher

- `README.md` : lancer et tester l'ensemble (pratique, pas architectural).
- `backend/README.md`, `web/README.md` : section « Le projet » en tête, pensée pour reprendre le code.
- `docs/CONCEPTION.md` : vision et modèle. Le code fait foi en cas de divergence.
- `docs/DESIGN_MIGRATION_V1.2.md` : journal des lots de l'interface web.
- `docs/DEPLOIEMENT.md`, `EXPLOITATION.md`, `USER_JOURNEYS.md`, `LISTING_RECOGNITION.md`, `LISTING_SOURCES.md`.
- `design_handoff_v2/` : maquettes de référence du design.

## Règles qui valent partout

- **Langue** :
  - **En anglais** : le code et tout ce qui s'y rattache (identifiants nouveaux, commentaires, noms de tests, messages de log) et les **messages de commit**. Anglais simple : phrases courtes, mots courants, pas d'idiomes.
  - **En français** : **tous les fichiers `.md`** (READMEs, `docs/`, ces `CLAUDE.md`), les **textes que lit l'utilisateur de l'app** (libellés, messages d'erreur affichés, aides) et la discussion avec le propriétaire.
  - Les identifiants existants sont en partie français (`Carte`, `Jaquette`, `ProprietaireCourant`). **Ne renomme pas en masse** : le nouveau code est en anglais, et en modifiant une ligne existante tu n'anglicises que ce que tu touches déjà. Un renommage massif noie l'historique et casse routes, clés de cache et migrations.
  - Un nom de domaine déjà public ou stocké reste tel quel : une route, une clé d'URL comme `/releases?mois=`, une colonne livrée. Ne le traduis pas à un seul endroit.
  - Ne modifie jamais une migration Flyway déjà livrée, pas même un commentaire (la somme de contrôle changerait).
- **Dépôt public** : jamais d'adresse, d'identifiant, de clé ni de réglage d'une installation précise dans un fichier suivi. Les notes personnelles vont dans un fichier `*.local.md` (ignoré par git). Les clés vont dans `backend/.env`, jamais dans le code.
- **Consolider plutôt qu'ajouter** : quand le travail n'est pas désigné, choisis dans cet ordre (1) ce qui est livré mais cassé ou incohérent, (2) ce qui est livré mais inatteignable ou muet, (3) ce qui est fragile. N'expose une interface que si la fonctionnalité derrière est réellement branchée.
- **Sources de métadonnées légitimes seulement** : pas de site de scans, même en secours. Mangacollec sert à vérifier les éditions françaises, pas de source pour l'app.
- **Aucun fournisseur n'est indispensable** : chaque écran a un secours, et l'app dit quand elle l'utilise. Une panne de fournisseur ne fait jamais échouer une recherche.

## Architecture en une minute

Le backend est un **modulith DDD** : un cœur (`core`) et quatre univers (`manga`, `videogame`, `boardgame`, `custom`). Un univers dépend du cœur, jamais l'inverse, jamais d'un autre univers. Le cœur expose des points d'extension que les univers implémentent. `ModulesTest` (Spring Modulith) vérifie ces frontières à chaque build.

Sécurité : l'API demande une session (cookie), sauf connexion, état de l'instance et liens de partage. Les données privées sont filtrées par propriétaire par `@TenantId` (Hibernate), pas dans les requêtes. Détails dans `backend/CLAUDE.md`.

## Vérifier un changement

| Tu as touché | Lance |
|---|---|
| `web/` | `npm test`, `npm run typecheck`, `npm run lint` (voir `web/CLAUDE.md`) |
| `backend/` | un sous-ensemble ciblé de tests (voir `backend/CLAUDE.md`) |
| un parcours d'écran | `npm run test:e2e` dans `web/` |

Une vérification qui ne s'exécute pas ne vaut rien : plusieurs commandes évidentes ne contrôlent rien ici (`npx tsc --noEmit`, `mvn` sans Docker). Voir les pièges dans chaque sous-dossier.

## Façon de travailler

- **Court et direct** : annonce l'action en une ou deux phrases, puis agis. Quand on te demande « on fait quoi ? », tranche et dis pourquoi, pas de menu d'options. Pose une question seulement si la réponse change vraiment le travail. Le détail technique va dans le message de commit et dans `docs/DESIGN_MIGRATION_V1.2.md`, pas dans le fil.
- **Maquettes à plusieurs planches** : si un export de design contient plusieurs planches du même écran, dis en une phrase ce que chacune propose et fais trancher **avant** la première ligne de code. Rien dans un zip ne dit laquelle fait foi, et se tromper coûte un lot entier.
- **« Je ne vois pas de changement »** : vérifie d'abord que le serveur de dev tourne encore. N'accuse pas le cache.
- **Fin de lot** : skill `/fin-de-lot` (vérification en direct sur données jetables avec retour à l'état d'avant, section dans `docs/DESIGN_MIGRATION_V1.2.md`, commit). Piège : une analyse d'achat jetable laisse une trace dans `market_price_observation` ; compte la table avant et après.
- **Éditer des fichiers par script** : la copie de travail mélange LF et CRLF (`core.autocrlf=true`). Un remplacement multi-lignes écrit avec `\n` peut ne trouver « 0 occurrence », et un texte inséré en LF rend le fichier mixte. Normalise pour chercher, puis réécris avec la fin de ligne d'origine ; vérifie toujours le nombre d'occurrences avant de remplacer. Les avertissements « LF will be replaced by CRLF » de git sont du bruit attendu.
- **Commandes Bash longues** : une commande de plus de ~5 Ko est tronquée sans message clair (on croit à une erreur de guillemets). Un fichier par appel, les gros fichiers en `cat >` puis `cat >>`.

## Git

### Branches

Le propriétaire peut commiter **directement sur `main`**. Pour tout le reste (autre intervenant, travail expérimental, changement risqué ou à relire), **évite `main`** : travaille sur une branche et laisse la fusion au propriétaire. Ne pousse jamais de force.

### Messages de commit

Conventional Commits, **en anglais** (sujet comme corps), `type: subject` (portée facultative, absente par défaut), impératif, sans point final, ~65 caractères. Termine par la ligne `Co-Authored-By` que la session impose. **Un commit = une intention.** Le détail (types, portées, corps) est dans le skill `/commit`, qui lance aussi la suite complète du dossier touché avant de commiter. Le type décide aussi du numéro de version (`feat` = mineur, `!` = majeur, le reste = patch) : voir « Numéro de version » dans `docs/DEPLOIEMENT.md`.

L'historique d'avant cette règle est en français : ne le réécris pas (ni rebase, ni `--amend` sur du déjà poussé). Les messages de fusion automatiques (`Merge remote-tracking branch …`) restent tels quels.
