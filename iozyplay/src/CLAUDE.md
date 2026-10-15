# Frontend (src/)

## Structure

- `App.tsx` : routes lazy — `/` (Home, `?room=X` → `/room/join`), `/username`, `/categories`, `/room/create`, `/room/join`, `/game`, `/editor`, `/editor/import-video`, `/settings`. Les routes sont dans un `ErrorBoundary`.
- `pages/XPage/` : `XPage.tsx` (wrapper route/contexte) + `X.tsx` (composant) + `X.module.scss`, sous-dossiers `ui/`, `question/`, `settings/` avec barrels `index.ts`.
- `lib/game/` : `GameContext` (simple `useState`, **non persisté** : un refresh sur `/game` ou `/room/create` renvoie à l'accueil) et pattern Strategy `strategies/` (Solo/Online) pour submit/validate/leave/score.
- `hooks/useRoomSocket.ts` : création/jonction de room (lobby).
- `services/` = logique métier utilisée par les pages ; `api/` = couche HTTP brute (`apiRequest`, `ApiError`) utilisée par les services. Les pages passent par `services/`, jamais par `api/` directement.
- `utils/socket.ts` : singleton socket.io (`connectSocket` / `getSocket`). URL = `VITE_SOCKET_URL`, fallback `localhost:3001` en dev.
- `types/` : types domaine (`Category` est un `string` dynamique) ; `lib/game/types.ts` : types de jeu ; `schemas/` : zod (éditeur uniquement, avec react-hook-form).

## Pièges

- **Le moteur de jeu est `pages/GamePage/Game.tsx`** (~1400 lignes, ~30 states/refs).
- Timing online : piloté par les events serveur (`game:go`, `game:reveal`, `game:next`) + refs (`mediaReadyRef`, `phaseStartTimeRef`, `gameDurationMsRef`) et des fallbacks (500 ms / 2 s / 3 s) répartis entre `QuestionCard`, `Game` et `YouTubePlayer`. Toucher à l'un implique de vérifier les autres.
- L'effet socket de `Game.tsx` a des deps réduites (`[gameMode, roomCode]`) : les handlers lisent des states figés. Passer par des refs pour toute nouvelle donnée lue dans un handler socket.
- Reconnexion centralisée dans `utils/socket.ts` : à chaque `connect` non initial, `room:rejoin` est émis pour la room courante (`setCurrentRoom` / `clearCurrentRoom`). Ne pas ajouter de listener `socket.on('reconnect')` (jamais déclenché en v4). `connectSocket` est idempotent.
- `sessionToken` par room (`utils/sessionToken.ts`, localStorage) : à renvoyer dans tout `room:join` / `room:rejoin`.
- Les questions reçues du serveur n'ont pas de `answer` : la réponse arrive au reveal (`correctAnswer`). Les suggestions viennent de l'API REST (`useAnswerSuggestions`) et sont filtrées par préfixe via `normalizeAnswer` (sans accents/majuscules/ponctuation).
- Hooks de lobby : `useRoomSocketCreate` / `useRoomSocketJoin` ; callbacks passés via ref (pas dans les deps).
- Point de départ des extraits : `Question.startTime` (secondes) ; toujours lire via `getQuestionStartTime(q)` (`utils/timecode.ts`, repli sur `t=` de l'URL YouTube). Le chrono démarre au premier PLAYING.
- Départ des extraits : **aléatoire à chaque partie**. Le serveur tire `startFraction` ∈ [0,1) par question (`withStartFractions`, solo : `SoloGameStrategy.getInitialQuestions`) ; le client la convertit avec `pickPlayableStart(startTime, duration, chrono, fraction)` (`utils/timecode.ts`) entre le « début minimum » (`startTime` / `t=`) et `durée − chrono`. `Question.duration` (relevée par l'éditeur via `GET /api/youtube/duration/:videoId`) est prioritaire sur la durée du lecteur : même départ pour tous, calculable avant la lecture. Média plus court que le chrono : départ à 0 et lecture en boucle. Au reveal, la vidéo repart du même départ (le player YouTube n'est jamais recréé) ; Le `title` de l'iframe est forcé à « Lecteur du blindtest » (anti-triche) — ne pas exposer titre/auteur de la vidéo avant le reveal.
- Écran `/game` : tient dans `100dvh` sans scroll ≥ 768 px (`Game.module.scss`, `.gameScreen`/`.mediaStage`) ; vérifier 1366×768, 1024×700, 800×600 et 375×812 après toute modif de layout.
- Boutons de jeu : barre du haut = « Inviter » (toast), « Son » (mute local du média, `settingsService.mediaMuted`), « Quitter » (toujours via `ConfirmDialog` puis `leaveRoom()` + `onEndGame()`). Pas de paramètres pendant une manche : « Changer les thèmes » n'existe que sur l'écran de fin, pour l'hôte. « Passer »/« Suivant » est un vote (compteur X/Y joueurs connectés).
- Réponse : une seule par question, = **contenu du champ**, modifiable jusqu'au reveal (solo et en ligne). Envoi automatique via `question/useAnswerAutoSend` (300 ms après la frappe, immédiat sur Entrée/suggestion, sous 3 s de chrono et avant un vote « Passer »). Le champ n'est figé (lecture seule) qu'au reveal ; une question validée (`validatedQuestionIndexRef`) ne repasse jamais en guess. Aucun retour juste/faux avant le reveal, solo compris.
- `room:state` est diffusé à chaque arrivée/départ : il ne doit pas réinitialiser la question en cours (`alreadyPlayingThisQuestion`). Reconnexion : `game:start` sur la même question = resynchronisation (rien n'est remis à zéro), `game:sync` réaligne le chrono, `room:rejoined` renvoie la réponse en cours.
- Un `game:start` reçu après la fin d'une partie = nouvelle partie (reset forcé dans `handleGameStarted`), ne pas se fier au changement de la liste de questions.
- Le lobby invité ne doit pas faire `room:leave` en partant vers `/game` (`navigatingToGameRef` dans `useRoomSocketJoin`).
- Avatars : `utils/playerAvatar.ts` (🎮 par défaut, aucune UI de choix pour l'instant).
- `eslint-plugin-react-hooks` n'est pas installé : rules-of-hooks/exhaustive-deps ne sont pas vérifiées. Relire les deps à la main.
- Éditeur : l'auto-save fait un PUT qui **remplace tout `data/questions.json`** ; il ne part qu'après une modification utilisateur, et l'éditeur n'est pas monté si le chargement échoue. Ne jamais réintroduire de sauvegarde sur données non chargées. Fragile avec plusieurs onglets ouverts.
- Thèmes : tokens dans `styles/design-tokens.scss`, classes `.dark-theme/.light-theme` sur `<html>` via `settingsService`. `styles/index.scss` contient surtout des classes globales inutilisées : préférer les SCSS modules + `styles/shared/DesignSystem.module.scss` (importé sous `ds`).
- Lire les réglages via `settingsService`, pas `localStorage['blindtest-settings']` directement.
- Service worker (`public/sw.js`) : désinscrit en dev ; en prod `skipWaiting` + reload auto au `controllerchange` (peut recharger en pleine partie).
- Deux `CategorySelector` distincts : `pages/CategorySelectorPage/` (lanceur de partie) et `components/editor/` (sélecteur de l'éditeur).

## Code mort connu

`emitWithQueue` / `isSocketConnected` (`utils/socket.ts`), la plupart des classes de `styles/index.scss`.

## Tests

Vitest + jsdom, setup `src/test/setup.ts`, fichiers `src/**/__tests__/*.test.ts`. Les tests sont exclus du `tsconfig` (non typecheckés).
