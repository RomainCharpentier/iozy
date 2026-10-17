/**
 * Domaine métier pur - Gestion des salons
 * Aucune dépendance externe (pas de Socket.io, Express, etc.)
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';

// Avatar attribué quand le client n'en fournit pas (ou en fournit un invalide)
export const DEFAULT_AVATAR = '🎮';

/**
 * Génère un code de salon unique
 */
export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Crée un nouveau salon
 */
export function createRoom(roomCode, hostPlayerId, hostSocketId, hostName, categories, defaultTimeLimit = 5, hostAvatar = DEFAULT_AVATAR) {
  return {
    code: roomCode,
    hostPlayerId, // UUID persistant du host
    players: [{
      id: hostPlayerId, // UUID persistant
      socketId: hostSocketId, // socket.id (peut changer)
      name: hostName || 'Hôte',
      avatar: hostAvatar || DEFAULT_AVATAR,
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
    // Jetons de session secrets { playerId: sessionToken } - jamais diffusés
    sessionTokens: {},
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
 * Ajoute un joueur à un salon.
 * Sans avatar fourni : DEFAULT_AVATAR pour un nouveau joueur, avatar conservé pour un joueur existant.
 */
export function addPlayer(room, playerId, socketId, playerName, playerAvatar) {
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
    avatar: playerAvatar || DEFAULT_AVATAR,
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

  const [removed] = room.players.splice(playerIndex, 1);
  if (room.sessionTokens && removed) {
    delete room.sessionTokens[removed.id];
  }
  room.updatedAt = Date.now();
  return room;
}

/**
 * Génère (ou régénère) le jeton de session secret d'un joueur.
 * Ce jeton n'est renvoyé qu'au joueur concerné et prouve son identité lors d'un rejoin.
 */
export function issueSessionToken(room, playerId) {
  if (!room || !playerId) return null;
  if (!room.sessionTokens) room.sessionTokens = {};
  const token = randomUUID();
  room.sessionTokens[playerId] = token;
  return token;
}

/**
 * Vérifie le jeton de session d'un joueur (comparaison à temps constant)
 */
export function verifySessionToken(room, playerId, token) {
  if (!room || !playerId || typeof token !== 'string') return false;
  const expected = room.sessionTokens?.[playerId];
  if (typeof expected !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Vue publique d'un joueur : ni socketId ni jeton de session
 */
export function toPublicPlayer(player) {
  if (!player) return player;
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar || DEFAULT_AVATAR,
    score: player.score,
    isHost: player.isHost || false,
    connected: player.connected || false
  };
}

export function toPublicPlayers(players) {
  return (players || []).map(toPublicPlayer);
}

/**
 * Vue publique d'une question : la réponse n'est jamais envoyée avant le reveal.
 * L'indice (hint) est conservé : il est conçu pour être affiché pendant la devinette.
 */
export function toPublicQuestion(question) {
  if (!question) return question;
  const { answer, ...publicQuestion } = question;
  return publicQuestion;
}

export function toPublicQuestions(questions) {
  return (questions || []).map(toPublicQuestion);
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
 * État de jeu diffusable : les réponses des joueurs sont remplacées par la liste
 * de ceux qui ont répondu ; la bonne réponse n'apparaît qu'après la validation (reveal).
 */
function getPublicGame(room) {
  if (!room.game) return null;
  const { answers, ...game } = room.game;
  game.answeredPlayers = Object.keys(answers || {});
  if (room.game.validatedAnswers?._validated === true) {
    game.correctAnswer = room.questions?.[room.game.questionIndex]?.answer;
  }
  return game;
}

/**
 * Récupère l'état complet de la room pour synchronisation
 */
export function getRoomState(room) {
  if (!room) return null;
  
  const state = {
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    players: toPublicPlayers(room.players),
    phase: room.gameState, // waiting, playing, finished
    settings: {
      categories: room.categories,
      defaultTimeLimit: room.defaultTimeLimit
    },
    game: getPublicGame(room), // { questionIndex, startedAt, durationMs, answeredPlayers, ... }
    questions: toPublicQuestions(room.questions), // Questions sans les réponses
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





