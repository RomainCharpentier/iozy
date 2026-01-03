/**
 * Domaine métier pur - Gestion des salons
 * Aucune dépendance externe (pas de Socket.io, Express, etc.)
 */

/**
 * Génère un code de salon unique
 */
export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Crée un nouveau salon
 */
export function createRoom(roomCode, hostPlayerId, hostSocketId, hostName, categories, defaultTimeLimit = 5, hostAvatar = '🎮') {
  return {
    code: roomCode,
    hostPlayerId, // UUID persistant du host
    players: [{
      id: hostPlayerId, // UUID persistant
      socketId: hostSocketId, // socket.id (peut changer)
      name: hostName || 'Hôte',
      avatar: hostAvatar,
      score: 0,
      isHost: true,
      connected: true
    }],
    categories,
    questions: [],
    currentQuestionIndex: 0,
    gameState: 'waiting', // waiting, playing, finished
    createdAt: Date.now(),
    updatedAt: Date.now(),
    defaultTimeLimit,
    // État du jeu pour synchronisation
    game: null // { questionIndex, startedAt, durationMs, answers: { playerId: answer } }
  };
}

/**
 * Vérifie si un joueur est l'hôte du salon
 */
export function isHost(room, socketId) {
  if (!room) return false;
  // Vérifier par socketId ou playerId
  const player = findPlayerBySocketId(room, socketId) || findPlayer(room, socketId);
  return player && player.isHost;
}

/**
 * Trouve un joueur par son socketId
 */
export function findPlayerBySocketId(room, socketId) {
  if (!room) return null;
  return room.players.find(p => p.socketId === socketId);
}

/**
 * Vérifie si le salon est en attente
 */
export function isWaiting(room) {
  return room && room.gameState === 'waiting';
}

/**
 * Vérifie si le salon est en cours de jeu
 */
export function isPlaying(room) {
  return room && room.gameState === 'playing';
}

/**
 * Trouve un joueur dans un salon par playerId
 */
export function findPlayer(room, playerId) {
  if (!room) return null;
  return room.players.find(p => p.id === playerId);
}

/**
 * Ajoute un joueur à un salon
 */
export function addPlayer(room, playerId, socketId, playerName, playerAvatar = '🎮') {
  if (!room) return null;
  
  // Vérifier si le joueur existe déjà par playerId
  const existingPlayer = findPlayer(room, playerId);
  if (existingPlayer) {
    // Mise à jour du socketId et reconnexion
    existingPlayer.socketId = socketId;
    existingPlayer.connected = true;
    existingPlayer.disconnectedAt = undefined;
    // Mettre à jour aussi le nom et avatar au cas où ils auraient changé
    if (playerName) existingPlayer.name = playerName;
    if (playerAvatar) existingPlayer.avatar = playerAvatar;
    room.updatedAt = Date.now();
    return room;
  }

  const player = {
    id: playerId, // UUID persistant
    socketId, // socket.id actuel
    name: playerName,
    avatar: playerAvatar,
    score: 0,
    isHost: false,
    connected: true
  };

  room.players.push(player);
  room.updatedAt = Date.now();
  return room;
}

/**
 * Retire un joueur d'un salon (par socketId ou playerId)
 */
export function removePlayer(room, socketIdOrPlayerId) {
  if (!room) return null;

  const playerIndex = room.players.findIndex(p => 
    p.id === socketIdOrPlayerId || p.socketId === socketIdOrPlayerId
  );
  if (playerIndex === -1) return room;

  room.players.splice(playerIndex, 1);
  room.updatedAt = Date.now();
  return room;
}

/**
 * Marque un joueur comme déconnecté (grace period)
 */
export function markPlayerDisconnected(room, socketId) {
  if (!room) return null;
  
  const player = findPlayerBySocketId(room, socketId);
  if (player) {
    player.connected = false;
    player.socketId = null; // Retirer le socketId mais garder le player
    player.disconnectedAt = Date.now(); // Timestamp de déconnexion
    room.updatedAt = Date.now();
  }
  
  return room;
}

/**
 * Reconnecte un joueur (pendant grace period)
 */
export function reconnectPlayer(room, playerId, socketId) {
  if (!room) return null;
  
  const player = findPlayer(room, playerId);
  if (player) {
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = undefined; // Réinitialiser le timestamp
    room.updatedAt = Date.now();
  }
  
  return room;
}

/**
 * Met à jour le nom d'un joueur
 */
export function updatePlayerName(room, socketId, newName) {
  if (!room) return null;

  const player = findPlayerBySocketId(room, socketId) || findPlayer(room, socketId);
  if (player) {
    player.name = newName;
    room.updatedAt = Date.now();
  }

  return room;
}

/**
 * Transfère l'hôte à un autre joueur connecté
 */
export function transferHost(room) {
  if (!room || room.players.length === 0) return null;

  // Retirer le statut d'hôte de tous les joueurs
  room.players.forEach(p => p.isHost = false);

  // Trouver le premier joueur connecté
  const connectedPlayer = room.players.find(p => p.connected);
  if (connectedPlayer) {
    room.hostPlayerId = connectedPlayer.id;
    connectedPlayer.isHost = true;
  } else if (room.players.length > 0) {
    // Fallback: prendre le premier joueur même s'il n'est pas connecté
    room.hostPlayerId = room.players[0].id;
    room.players[0].isHost = true;
  }

  room.updatedAt = Date.now();
  return room;
}

/**
 * Vérifie si un salon peut être supprimé (plus de joueurs)
 */
export function canDeleteRoom(room) {
  return room && room.players.length === 0;
}

/**
 * Récupère l'état complet de la room pour synchronisation
 */
export function getRoomState(room) {
  if (!room) return null;
  
  const state = {
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      socketId: p.socketId,
      score: p.score,
      isHost: p.isHost || false,
      connected: p.connected || false
    })),
    phase: room.gameState, // waiting, playing, finished
    settings: {
      categories: room.categories,
      defaultTimeLimit: room.defaultTimeLimit
    },
    game: room.game ? { ...room.game } : null, // { questionIndex, startedAt, durationMs, answers }
    questions: room.questions || [], // Inclure les questions dans l'état
    updatedAt: room.updatedAt
  };
  
  // Calculer le temps restant depuis le serveur pour synchronisation parfaite
  if (state.game && room.gameState === 'playing') {
    const now = Date.now();
    
    if (room.game.readyPlayers instanceof Set) {
      state.game.readyPlayers = Array.from(room.game.readyPlayers);
    }
    
    const connectedPlayers = room.players.filter(p => p.connected);
    const readyPlayers = Array.from(room.game.readyPlayers || []);
    const allReady = connectedPlayers.length > 0 && 
                     connectedPlayers.every(p => room.game.readyPlayers.has(p.id));
    
    if (state.game.startedAt && state.game.durationMs) {
      state.game.step = 'playing';
      const elapsed = now - state.game.startedAt;
      state.game.timeRemainingMs = Math.max(0, state.game.durationMs - elapsed);
      state.game.serverTime = now;
    } else if (state.game.goAt) {
      state.game.step = 'starting';
      state.game.serverTime = now;
    } else if (allReady) {
      state.game.step = 'ready';
      state.game.readyCount = readyPlayers.length;
      state.game.totalPlayers = connectedPlayers.length;
    } else {
      state.game.step = 'loading';
      state.game.readyCount = readyPlayers.length;
      state.game.totalPlayers = connectedPlayers.length;
    }
  }
  
  return state;
}





