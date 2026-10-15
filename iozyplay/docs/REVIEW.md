# Revue du projet — octobre 2026

État au commit `40ad7ab`. Backlog priorisé ; cocher / supprimer au fil des corrections.

> Lot de corrections P0/P1 fusionné sur `fix/review-batch` (items cochés). Restent : PUT/profils REST sans auth, `profileRepository` (JSON corrompu), `GET /api/questions` expose `answer`+`mediaUrl` (triche possible côté REST).

> Second lot (tests réels) : écran de jeu sans scroll, `startTime` des extraits, vidéo continue au reveal, titre YouTube masqué, avatars transmis, tirage aléatoire + « Rejouer » qui re-tire, timer 20 s par défaut, formulaire éditeur stylé. Reste : choix d'avatar (pas d'UI), libellé « Média » pour les catégories perso en jeu, `mediaUrl`/ID vidéo visibles côté client (limite YouTube).

## Résultats des checks

| Check | Résultat |
|---|---|
| `npm run typecheck` | 0 erreur (tests exclus du tsconfig) |
| `npm run lint` | 0 erreur, 72 warnings (49 unused-vars, 18 any, 5 preserve-caught-error) — ne bloque jamais |
| `npm test` (back) | 20/21 — `synchronization.test.mjs:139` attend `goAt = now+1500`, le code utilise `+1000` (`gameHandlers.js:387`) |
| `npm run test:unit` (front) | 9/9 (un seul fichier : `utils/__tests__/youtube.test.ts`) |
| Prettier | 19 fichiers non formatés |

## P0 — Perte de données / crash

- [x] **Éditeur efface les catégories personnalisées** : `QuestionService.saveQuestions` (`src/services/questionService.ts:108`) ne garde que 5 catégories codées en dur puis PUT remplace tout `data/questions.json`. Aggravé par l'auto-save à l'ouverture (`QuestionEditor.tsx:199-211`) et `loadQuestions` qui renvoie des tableaux vides en cas d'erreur (`questionService.ts:100`).
- [x] **Crash serveur sur payload invalide** : `game:answer` avec une réponse non-string → `.trim()` dans un `setTimeout` (`answerUtils.js:17` via `game.js:149`) ; handlers qui déstructurent un payload absent.
- [x] **Repositories JSON** : écritures concurrentes sans verrou ; JSON corrompu avalé (`{}`) puis écrasé à l'écriture suivante.

## P1 — Bugs fonctionnels

- [x] `socket.on('reconnect')` jamais déclenché en socket.io v4 (`Game.tsx:1008`, `useRoomSocket.ts:123,250`, `utils/socket.ts:53`) → pas de `room:rejoin` après coupure.
- [x] Sockets multiples : `connectSocket` recrée un `io()` si pas encore connecté, et l'effet de `useRoomSocket` (`:284`) se relance à chaque render (callback inline `RoomCreator.tsx:63`).
- [ ] `room:leave` ne transfère jamais l'hôte (`removePlayer` avant `isHost`, `roomHandlers.js:221-227`).
- [ ] Partie bloquée si un joueur se déconnecte pendant le chargement (pas de re-check « tous prêts », `gameHandlers.js:369-385`) ; `voteSkip` exige aussi les joueurs déconnectés (`game.js:254`).
- [ ] Double scoring possible : skip unanime avant `game:go` puis `game:ready` tardif (`gameHandlers.js:385-394`, `:468-472`). `storeAnswer` n'a aucun contrôle de phase (`game.js:112`).
- [ ] Collision de code de room non vérifiée (`room.js:10`).
- [ ] `addQuestion` plante si la catégorie n'existe pas dans le fichier ; `deleteQuestion` sans `category` plante (`questionRepository.js:59,80`).
- [ ] `room:join` d'un joueur connu en cours de partie n'appelle pas `syncPlayerToGame` (`roomHandlers.js:120-133`).
- [ ] Avatar perdu dans `room:state` (`room.js:221`).
- [x] Hooks conditionnels : `QuestionCard.tsx:74→82`, `useRoomSocket.ts:309`.
- [ ] Closures figées : `handleGameReveal` (`Game.tsx:912`), handlers non branchés si socket pas connecté au montage (`:572-585`), callbacks YouTube capturés à la création (`YouTubePlayer.tsx:117`).
- [ ] `RoomCreator.handleStartGame` ne remet pas `isStartingGame` à false sur plusieurs chemins d'erreur.
- [x] Lien `/editor/import-video` vers une route inexistante (`QuestionEditor.tsx:823`).
- [ ] Les réglages son ne sont appliqués qu'après ouverture de `/settings` (`SettingsMenu.tsx:16`).
- [ ] Le service worker peut recharger la page en pleine partie (`serviceWorker.ts:85`, `UpdateNotification.tsx:15`).

## P1 — Sécurité / triche

- [x] Les réponses (`answer`) et les réponses des autres joueurs sont diffusées à tous (`game:start`, `game:next`, `room:state` — `room.js:234-235`).
- [x] Usurpation d'hôte : `room:state` expose les `playerId`, et `room:rejoin` avec ce playerId suffit (`roomHandlers.js:181-189`).
- [ ] REST sans auth : `PUT /api/questions` remplace tout, profils lisibles/supprimables, `updateCategory` permet de changer l'`id`.
- [ ] CORS prod : `origin: true` + credentials si `FRONTEND_URL` absent (`server.js:18`, `socket.js:12`).
- [x] `defaultTimeLimit` non validé (0 / négatif / NaN) ; `playlistId` non encodé (`youtubeHandlers.js:18`).

## P2 — Outillage

- [ ] `build` et la CI avalent les erreurs (`|| true`) ; lint avec `--max-warnings 999`.
- [ ] Installer `eslint-plugin-react-hooks` (rules-of-hooks + exhaustive-deps).
- [x] Quoter le glob de `npm test` (`"server/**/*.test.mjs"`) et corriger le test `+1500`.
- [ ] Inclure les tests dans le typecheck ; importer `@testing-library/jest-dom` dans `src/test/setup.ts`.
- [ ] Déclarer `VITE_API_URL` dans `vite-env.d.ts` (aujourd'hui `import.meta as any`).
- [ ] CI sur Node 20 et Netlify sur Node 20 alors que `engines` exige ≥22.
- [ ] README obsolète (React 18, CSS3).

## P2 — Code mort / duplication

- [ ] Front : `lib/game/useGameSocket.ts`, `useGameTimer.ts`, `AuthPage`, `authService`, `profileService`, `ProtectedRoute`, `ErrorBoundary` (ou le monter !), `VideoImporter`/`VideoImportPage`, `StyleSelector` + `styles/variants/*`, `types/gameConfig.ts`, `styles/settings-menu.scss`, la majorité de `styles/index.scss`, `emitWithQueue`, `isSocketConnected`, appel ignoré `QuestionService.loadQuestions()` dans `App.tsx:31`, `questionsApi.update/getByCategory` (routes absentes).
- [ ] Dépendances inutilisées : `@radix-ui/react-dropdown-menu`, `-label`, `-select`, `-tabs`, `-tooltip`.
- [ ] Back : `checkAnswer` (deprecated), `isGameFinished`, `findByPlayer`/`findAllByPlayer`, `getGameState`, `defaultIds` ; listener client `game:correct-answer` jamais émis ; `game:state` émis jamais écouté.
- [ ] Duplication : `broadcastRoomState`/`syncPlayerToGame`/`sendError` entre handlers ; logique reveal → next ×3 dans `gameHandlers.js`.
- [ ] Fichiers Windows hérités : `~/.bash_profile`, `start.sh`, `setup-path.sh`, `configure-path.ps1`.

## P3 — Dette structurelle

- `Game.tsx` (~1400 lignes) concentre tout le runtime : à découper (hook socket, hook timer — en repartant des copies mortes de `lib/game/` ou en les supprimant).
- Pas de contrat d'événements typé partagé client/serveur.
- Pas de cache côté services (N+1 GET dans `CategorySelector.tsx:43`).
- 118 `style={{}}` inline malgré les SCSS modules.
- Rooms en mémoire + fichiers JSON sur FS éphémère : incompatible avec plusieurs instances et avec la persistance de l'éditeur en prod.
