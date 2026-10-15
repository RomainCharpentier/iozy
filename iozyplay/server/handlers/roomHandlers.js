/**
 * Gestionnaires d'événements Socket.io pour les salons
 */

import { 
  generateRoomCode, 
  createRoom, 
  isHost, 
  isWaiting, 
  addPlayer, 
  removePlayer, 
  updatePlayerName, 
  transferHost, 
  canDeleteRoom,
  markPlayerDisconnected,
  reconnectPlayer,
  findPlayerBySocketId,
  findPlayer,
  getRoomState,
  issueSessionToken,
  verifySessionToken,
  toPublicPlayers,
  toPublicQuestion,
  toPublicQuestions
} from '../domain/room.js';
import { getGameState } from '../domain/game.js';
import { roomRepository } from '../infrastructure/roomRepository.js';
import {
  withPayload,
  sendInvalidPayload,
  isValidRoomCode,
  isValidPlayerId,
  isValidCategories,
  normalizePlayerName,
  normalizeAvatar,
  normalizeTimeLimit
} from './validation.js';

/**
 * Envoie l'état de la room à tous les clients
 */
function broadcastRoomState(io, roomCode, room) {
  const state = getRoomState(room);
  if (state) {
    // Broadcaster à tous les sockets dans la room
    io.to(roomCode).emit('room:state', state);
  }
}

/**
 * Envoie une erreur standardisée
 */
function sendError(socket, code, message) {
  socket.emit('error', { code, message });
}

/**
 * Synchronise un joueur qui rejoint une partie en cours
 */
function syncPlayerToGame(socket, room) {
  if (room.gameState !== 'playing' || !room.game) {
    return;
  }

  const gameStartData = {
    currentQuestion: toPublicQuestion(room.questions[room.game.questionIndex]),
    questions: toPublicQuestions(room.questions),
    questionIndex: room.game.questionIndex,
    players: toPublicPlayers(room.players),
    defaultTimeLimit: room.defaultTimeLimit,
    durationMs: room.game.durationMs
  };
  socket.emit('game:start', gameStartData);

  // Si la partie a déjà démarré, synchroniser directement avec le temps restant
  if (room.game.startedAt && room.game.durationMs) {
    const now = Date.now();
    const elapsed = now - room.game.startedAt;
    const timeRemainingMs = Math.max(0, room.game.durationMs - elapsed);

    socket.emit('game:sync', {
      startedAt: room.game.startedAt,
      durationMs: room.game.durationMs,
      timeRemainingMs,
      serverTime: now,
      questionIndex: room.game.questionIndex
    });
  } else if (room.game.goAt) {
    // La partie attend le signal "go", envoyer les informations de synchronisation
    socket.emit('game:go', {
      goAt: room.game.goAt,
      startedAt: room.game.startedAt || room.game.goAt,
      durationMs: room.game.durationMs,
      serverTime: Date.now()
    });
  }
}

export function setupRoomHandlers(socket, io) {
  socket.on('room:create', withPayload(socket, 'room:create', async ({ playerId, playerName, categories, defaultTimeLimit }) => {
    if (!playerId) {
      sendError(socket, 'INVALID_PLAYER_ID', 'playerId requis');
      return;
    }

    const finalPlayerName = normalizePlayerName(playerName, 'Hôte');
    if (!isValidPlayerId(playerId) || finalPlayerName === null || !isValidCategories(categories)) {
      sendInvalidPayload(socket);
      return;
    }

    const roomCode = generateRoomCode();
    const room = createRoom(roomCode, playerId, socket.id, finalPlayerName, categories, normalizeTimeLimit(defaultTimeLimit));
    // Jeton secret renvoyé uniquement au créateur (protège l'identité de l'hôte)
    const sessionToken = issueSessionToken(room, playerId);
    
    roomRepository.create(room);
    socket.join(roomCode);
    
    const state = getRoomState(room);
    socket.emit('room:created', { roomCode, room: state, sessionToken });
    broadcastRoomState(io, roomCode, room);
  }));

  socket.on('room:join', withPayload(socket, 'room:join', async ({ roomCode, playerId, playerName, playerAvatar, sessionToken }) => {
    if (!playerId) {
      sendError(socket, 'INVALID_PLAYER_ID', 'playerId requis');
      return;
    }

    const finalPlayerName = normalizePlayerName(playerName, 'Joueur');
    if (!isValidPlayerId(playerId) || !isValidRoomCode(roomCode) || finalPlayerName === null) {
      sendInvalidPayload(socket);
      return;
    }

    const room = roomRepository.get(roomCode);
    
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon introuvable');
      return;
    }

    // Vérifier si le joueur existe déjà (reconnexion)
    const existingPlayer = findPlayer(room, playerId);
    if (existingPlayer) {
      // Le playerId est public : exiger le jeton de session pour reprendre ce joueur
      if (!verifySessionToken(room, playerId, sessionToken)) {
        sendError(socket, 'INVALID_SESSION', 'Session invalide pour ce joueur');
        return;
      }
      // Reconnecter le joueur et mettre à jour le nom
      reconnectPlayer(room, playerId, socket.id);
      if (finalPlayerName) existingPlayer.name = finalPlayerName;
      roomRepository.cancelGracePeriod(roomCode, playerId);
      roomRepository.update(roomCode, room);
      socket.join(roomCode);
      
      const state = getRoomState(room);
      socket.emit('room:joined', { room: state, sessionToken });
      
      // Broadcaster immédiatement à tous les autres joueurs
      broadcastRoomState(io, roomCode, room);
      return;
    }

    // Nouveau joueur - vérifier que la partie n'a pas commencé
    // Si la partie a commencé, permettre quand même la reconnexion et envoyer l'état actuel
    if (!isWaiting(room)) {
      // La partie a déjà commencé, permettre la reconnexion
      // Le joueur recevra l'état actuel de la partie
      addPlayer(room, playerId, socket.id, finalPlayerName);
      const newSessionToken = issueSessionToken(room, playerId);
      roomRepository.update(roomCode, room);
      socket.join(roomCode);
      
      const state = getRoomState(room);
      socket.emit('room:joined', { room: state, sessionToken: newSessionToken });
      syncPlayerToGame(socket, room);
      broadcastRoomState(io, roomCode, room);
      return;
    }

    addPlayer(room, playerId, socket.id, finalPlayerName, normalizeAvatar(playerAvatar, '🎮'));
    const newSessionToken = issueSessionToken(room, playerId);
    roomRepository.update(roomCode, room);
    
    // Joindre la room AVANT de broadcaster
    socket.join(roomCode);
    
    const state = getRoomState(room);
    socket.emit('room:joined', { room: state, sessionToken: newSessionToken });
    
    // Broadcaster à tous les autres joueurs (le nouveau joueur a déjà reçu room:joined)
    // Utiliser setImmediate pour s'assurer que le socket est bien dans la room
    setImmediate(() => {
      broadcastRoomState(io, roomCode, room);
    });
  }));

  socket.on('room:rejoin', withPayload(socket, 'room:rejoin', async ({ roomCode, playerId, sessionToken }) => {
    if (!playerId) {
      sendError(socket, 'INVALID_PLAYER_ID', 'playerId requis');
      return;
    }

    if (!isValidPlayerId(playerId) || !isValidRoomCode(roomCode)) {
      sendInvalidPayload(socket);
      return;
    }

    const room = roomRepository.get(roomCode);
    
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon introuvable');
      return;
    }

    const existingPlayer = findPlayer(room, playerId);
    if (!existingPlayer) {
      sendError(socket, 'PLAYER_NOT_FOUND', 'Joueur introuvable dans ce salon');
      return;
    }

    // Le playerId est public : exiger le jeton de session pour reprendre ce joueur
    if (!verifySessionToken(room, playerId, sessionToken)) {
      sendError(socket, 'INVALID_SESSION', 'Session invalide pour ce joueur');
      return;
    }


    // Reconnecter le joueur
    reconnectPlayer(room, playerId, socket.id);
    roomRepository.cancelGracePeriod(roomCode, playerId);
    roomRepository.update(roomCode, room);
    socket.join(roomCode);
    
    const state = getRoomState(room);
    socket.emit('room:rejoined', { room: state });
    socket.emit('room:state', state);
    syncPlayerToGame(socket, room);
    broadcastRoomState(io, roomCode, room);
  }));

  socket.on('update-player-name', withPayload(socket, 'update-player-name', ({ roomCode, playerName }) => {
    const finalPlayerName = normalizePlayerName(playerName, null);
    if (!isValidRoomCode(roomCode) || !finalPlayerName) {
      sendInvalidPayload(socket);
      return;
    }

    const room = roomRepository.get(roomCode);
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon introuvable');
      return;
    }

    updatePlayerName(room, socket.id, finalPlayerName);
    roomRepository.update(roomCode, room);
    broadcastRoomState(io, roomCode, room);
  }));

  socket.on('room:leave', withPayload(socket, 'room:leave', ({ roomCode }) => {
    if (!isValidRoomCode(roomCode)) {
      sendInvalidPayload(socket);
      return;
    }

    const room = roomRepository.get(roomCode);
    if (!room) return;

    const player = findPlayerBySocketId(room, socket.id);
    if (!player) return;

    const playerId = player.id;
    removePlayer(room, playerId);
    roomRepository.cancelGracePeriod(roomCode, playerId);
    socket.leave(roomCode);
    
    if (isHost(room, socket.id) && room.players.length > 0) {
      transferHost(room);
    }
    
    if (canDeleteRoom(room)) {
      roomRepository.delete(roomCode);
    } else {
      roomRepository.update(roomCode, room);
      broadcastRoomState(io, roomCode, room);
    }
  }));

  // Gestion améliorée des déconnexions
  socket.on('disconnect', (reason) => {
    // Trouver toutes les rooms où ce socket est présent
    const allRooms = roomRepository.getAll();
    
    allRooms.forEach(room => {
      const player = findPlayerBySocketId(room, socket.id);
      if (!player) return;

      const playerId = player.id;
      const roomCode = room.code;
      
      // Marquer comme déconnecté (grace period)
      markPlayerDisconnected(room, socket.id);
      roomRepository.update(roomCode, room);
      
      // Démarrer le grace period
      roomRepository.startGracePeriod(roomCode, playerId, () => {
        // Grace period expirée - supprimer le joueur
        const currentRoom = roomRepository.get(roomCode);
        if (!currentRoom) return;

        const stillDisconnected = findPlayer(currentRoom, playerId);
        if (stillDisconnected && !stillDisconnected.connected) {
          removePlayer(currentRoom, playerId);
          
          // Vérifier si le host est parti
          if (currentRoom.hostPlayerId === playerId && currentRoom.players.length > 0) {
            transferHost(currentRoom);
          }
          
          if (canDeleteRoom(currentRoom)) {
            roomRepository.delete(roomCode);
          } else {
            roomRepository.update(roomCode, currentRoom);
            broadcastRoomState(io, roomCode, currentRoom);
          }
        }
      }, 20000); // 20 secondes de grace period
      
      // Broadcast immédiat de l'état (joueur déconnecté)
      broadcastRoomState(io, roomCode, room);
    });
  });
}

