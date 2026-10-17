# Backend (server/)

## Structure

- `index.js` : HTTP + Express + Socket.IO, branche `setupRoomHandlers` et `setupGameHandlers` à chaque connexion.
- `config/` : app Express (CORS, routes REST) et options Socket.IO (`connectionStateRecovery` 2 min).
- `domain/` : logique pure (`room.js`, `game.js`, `answerUtils.js`). Les fonctions **mutent l'objet room** en place.
- `handlers/` : adaptateurs socket (`roomHandlers`, `gameHandlers`) et REST (questions, categories, profiles, youtube).
- `infrastructure/` : `roomRepository` (singleton en mémoire : rooms, timers de grâce de 20 s par joueur, un timer de jeu par room) + repositories JSON sur `data/*.json`. `questionRepository` : écritures atomiques sérialisées, JSON corrompu → erreur (jamais d'écrasement) ; chemin surchargeable via `QUESTIONS_FILE` (tests).

## Événements Socket.IO

- Client → serveur : `room:create|join|rejoin|leave`, `update-player-name`, `game:start|restart|restart-with-categories|get-state|ready|answer|skip-vote|next`.
- Serveur → client : `room:state` (broadcast), `room:created|joined|rejoined`, `error` (`{ code, message }`, codes en MAJUSCULES comme `ROOM_NOT_FOUND`), `game:start|sync|go|answer-stored|skip-vote-updated|answers-validated|reveal|next|end`.
- Toute modification d'un nom ou d'un payload doit être répercutée côté client (`src/pages/GamePage/Game.tsx`, `src/hooks/useRoomSocket.ts`) : il n'y a pas de types partagés.

## Cycle d'une question

1. `game:start` / `game:next` → chaque client émet `game:ready` quand son média est chargé.
2. Tous les joueurs **connectés** prêts → `goAt = max(now + 1000, transitionUntil)`, `game:go` émis 1 s avant `goAt` (différé pendant la transition de `QUESTION_TRANSITION_MS` = 3 s posée par `nextQuestion`, pas pour la 1re question), puis `startedAt = goAt` et timer de devinette.
3. Fin du timer (ou skip unanime) → `validateAnswers` → `game:answers-validated` + `game:reveal` → second timer → `game:next` ou `game:end`.

Il n'y a pas de champ « phase » : devinette vs reveal se déduit de `game.validatedAnswers._validated`. `setGameTimer` remplace le timer précédent de la room. La logique reveal → next est dupliquée à 3 endroits de `gameHandlers.js` : les modifier ensemble.

Départ des extraits : à chaque tirage (`setQuestionPool`, `restartGame`), chaque question reçoit une `startFraction` aléatoire (`domain/questionMedia.js`), convertie en secondes par les clients ; `duration` (secondes, facultatif) est validée comme `startTime`. `GET /api/youtube/duration/:videoId` lit la durée sur la page YouTube (pas de clé d'API).

Tirage : l'hôte envoie dans `game:start` tout le pool dédupliqué + `questionCount` ; le serveur garde `room.questionPool` et tire la sélection (`domain/questionDraw.js`, Fisher-Yates). « Rejouer » refait un tirage en évitant la partie précédente. Timer : 10–60 s, 20 s par défaut (`TIME_LIMIT` dans `validation.js`, `TIMING` côté client).

Score : +1 par bonne réponse, validation en lot à la fin du timer. `compareAnswers` normalise (accents, casse, ponctuation) puis tolère une distance de Levenshtein ≤1 (≤5 caractères) ou ≤10 %.

## Pièges

- La plupart des handlers retrouvent le joueur par **socketId** ; après `disconnect` il vaut `null` jusqu'au `room:rejoin` du client.
- `readyPlayers` et `skipVotes` sont des `Set` : convertir avant toute sérialisation (`getRoomState`).
- Payloads socket : tout handler est enveloppé par `withPayload` et valide ses champs via `handlers/validation.js` (erreur `INVALID_PAYLOAD`). Tout nouveau handler doit faire de même ; les callbacks de timers sont dans un try/catch.
- `broadcastRoomState`, `syncPlayerToGame`, `sendError` sont dupliqués dans les deux fichiers de handlers.
- Anti-triche : les questions envoyées aux clients n'ont **jamais** de champ `answer` ; la bonne réponse part seulement dans `game:reveal` / `game:answers-validated` (`correctAnswer`). `room:state` expose `answeredPlayers`, pas les réponses. Les joueurs sortent via `toPublicPlayer` (pas de `socketId`).
- Identité : `sessionToken` secret émis dans `room:created` / `room:joined` (stocké dans `room.sessionTokens`, jamais diffusé), exigé par `room:rejoin` / `room:join` pour un playerId existant (sinon `INVALID_SESSION`).
- REST toujours sans authentification, et `GET /api/questions` renvoie les réponses.

## Tests

`node:test` + `node:assert`, fichiers `*.test.mjs` à côté du code. Les tests de handlers utilisent des mocks `socket`/`io` mais le **vrai singleton** `roomRepository` (nettoyer en `beforeEach`). Ne jamais écrire dans le vrai `data/` depuis un test.
