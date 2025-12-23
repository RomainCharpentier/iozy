# Architecture du serveur

## Structure en couches

Le serveur suit une architecture en couches (Clean Architecture) pour séparer le cœur de métier des dépendances externes.

### 📁 Domain (Domaine métier pur)
**`server/domain/`**

Contient la logique métier pure, **sans aucune dépendance externe** (pas de Socket.io, Express, etc.).

- `room.js` : Logique métier pour la gestion des salons
  - `generateRoomCode()` : Génère un code unique
  - `createRoom()` : Crée un nouveau salon
  - `isHost()` : Vérifie si un joueur est l'hôte
  - `addPlayer()` / `removePlayer()` : Gestion des joueurs
  - `transferHost()` : Transfère l'hôte

- `game.js` : Logique métier pour le jeu
  - `startGame()` : Démarre une partie
  - `restartGame()` : Relance une partie
  - `checkAnswer()` : Vérifie une réponse
  - `nextQuestion()` : Passe à la question suivante
  - `getGameState()` : Récupère l'état du jeu

**Principe** : Ces fichiers peuvent être testés unitairement sans Socket.io ou Express.

### 🏗️ Infrastructure (Implémentations concrètes)
**`server/infrastructure/`**

Contient les implémentations concrètes pour le stockage et la persistance.

- `roomRepository.js` : Repository pour la gestion des salons en mémoire
  - En production, pourrait être remplacé par Redis ou une base de données

**Principe** : Ces fichiers dépendent du domaine mais pas de Socket.io/Express.

### 🎯 Handlers (Gestionnaires d'événements)
**`server/handlers/`**

Gestionnaires d'événements Socket.io qui font le lien entre le domaine et Socket.io.

- `roomHandlers.js` : Gestionnaires pour les événements de salon
  - `create-room`, `join-room`, `leave-room`, `update-player-name`

- `gameHandlers.js` : Gestionnaires pour les événements de jeu
  - `start-game`, `restart-game`, `player-answer`, `time-up`, etc.

**Principe** : Ces fichiers dépendent du domaine et de Socket.io, mais contiennent uniquement la logique de coordination.

### ⚙️ Config (Configuration)
**`server/config/`**

Configuration des frameworks externes.

- `server.js` : Configuration Express
- `socket.js` : Configuration Socket.io

**Principe** : Séparation de la configuration du code métier.

### 🚀 Index (Point d'entrée)
**`server/index.js`**

Point d'entrée du serveur qui assemble tous les composants.

## Flux de données

```
Socket.io Event
    ↓ reçu par
Handler (roomHandlers.js / gameHandlers.js)
    ↓ utilise
Domain (room.js / game.js) - Logique pure
    ↓ utilise
Repository (roomRepository.js) - Stockage
```

## Exemple d'utilisation

```javascript
// ❌ MAUVAIS : Logique métier dans le handler
socket.on('create-room', ({ playerName }) => {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = {
    code: roomCode,
    host: socket.id,
    players: [{ id: socket.id, name: playerName, score: 0 }],
    // ...
  };
  rooms.set(roomCode, room);
});

// ✅ BON : Utilisation du domaine
socket.on('create-room', ({ playerName, categories }) => {
  const roomCode = generateRoomCode();
  const room = createRoom(roomCode, socket.id, playerName, categories);
  roomRepository.create(room);
  socket.join(roomCode);
  socket.emit('room-created', { roomCode, room });
});
```

## Avantages

1. **Testabilité** : Le domaine peut être testé sans Socket.io, Express, etc.
2. **Réutilisabilité** : Le domaine peut être utilisé dans d'autres projets
3. **Maintenabilité** : Séparation claire des responsabilités
4. **Flexibilité** : Facile de changer d'implémentation (ex: remplacer Map par Redis)

## Règles

- ✅ Le domaine ne doit **jamais** importer depuis `handlers/`, `config/`, `infrastructure/`
- ✅ Les handlers ne doivent **jamais** contenir de logique métier complexe
- ✅ Toute logique métier doit être dans `domain/`
- ✅ Les dépendances externes (Socket.io, Express) doivent être abstraites






