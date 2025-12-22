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
  getRoomState
} from '../domain/room.js';
import { getGameState } from '../domain/game.js';
import { roomRepository } from '../infrastructure/roomRepository.js';

/**
 * Envoie l'état de la room à tous les clients
 */
function broadcastRoomState(io, roomCode, room) {
  const state = getRoomState(room);
  if (state) {
    io.to(roomCode).emit('room:state', state);
  }
}

/**
 * Envoie une erreur standardisée
 */
function sendError(socket, code, message) {
  socket.emit('error', { code, message });
}

export function setupRoomHandlers(socket, io) {
  socket.on('room:create', ({ playerId, playerName, categories, defaultTimeLimit = 5 }) => {
    if (!playerId) {
      sendError(socket, 'INVALID_PLAYER_ID', 'playerId requis');
      return;
    }

    const roomCode = generateRoomCode();
    const room = createRoom(roomCode, playerId, socket.id, playerName, categories, defaultTimeLimit);
    
    roomRepository.create(room);
    socket.join(roomCode);
    
    const state = getRoomState(room);
    socket.emit('room:created', { roomCode, room: state });
    broadcastRoomState(io, roomCode, room);
  });

  socket.on('room:join', ({ roomCode, playerId, playerName }) => {
    if (!playerId) {
      sendError(socket, 'INVALID_PLAYER_ID', 'playerId requis');
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
      // Reconnecter le joueur
      reconnectPlayer(room, playerId, socket.id);
      roomRepository.cancelGracePeriod(roomCode, playerId);
      roomRepository.update(roomCode, room);
      socket.join(roomCode);
      
      const state = getRoomState(room);
      socket.emit('room:joined', { room: state });
      broadcastRoomState(io, roomCode, room);
      return;
    }

    // Nouveau joueur - vérifier que la partie n'a pas commencé
    // Si la partie a commencé, permettre quand même la reconnexion et envoyer l'état actuel
    if (!isWaiting(room)) {
      // La partie a déjà commencé, mais on permet quand même la reconnexion
      // Le joueur recevra l'état actuel de la partie
      console.log(`[Room] Tentative de rejoindre une partie en cours: ${roomCode}, joueur: ${playerId}`);
      
      // Ajouter le joueur quand même (il pourra observer la partie)
      addPlayer(room, playerId, socket.id, playerName);
      roomRepository.update(roomCode, room);
      socket.join(roomCode);
      
      const state = getRoomState(room);
      socket.emit('room:joined', { room: state });
      
      if (room.gameState === 'playing' && room.game) {
        socket.emit('game:start', {
          currentQuestion: room.questions[room.game.questionIndex],
          questions: room.questions,
          questionIndex: room.game.questionIndex,
          players: room.players,
          defaultTimeLimit: room.defaultTimeLimit,
          durationMs: room.game.durationMs
        });
        
        if (room.game.goAt) {
          socket.emit('game:go', {
            goAt: room.game.goAt,
            startedAt: room.game.startedAt || room.game.goAt,
            durationMs: room.game.durationMs,
            serverTime: Date.now()
          });
        }
      }
      
      broadcastRoomState(io, roomCode, room);
      return;
    }

    addPlayer(room, playerId, socket.id, playerName);
    roomRepository.update(roomCode, room);
    socket.join(roomCode);
    
    const state = getRoomState(room);
    socket.emit('room:joined', { room: state });
    broadcastRoomState(io, roomCode, room);
  });

  socket.on('room:rejoin', ({ roomCode, playerId }) => {
    if (!playerId) {
      sendError(socket, 'INVALID_PLAYER_ID', 'playerId requis');
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

    // Reconnecter le joueur
    reconnectPlayer(room, playerId, socket.id);
    roomRepository.cancelGracePeriod(roomCode, playerId);
    roomRepository.update(roomCode, room);
    socket.join(roomCode);
    
    const state = getRoomState(room);
    socket.emit('room:rejoined', { room: state });
    
    if (room.gameState === 'playing' && room.game) {
      const roomState = getRoomState(room);
      socket.emit('room:state', roomState);
      
      socket.emit('game:start', {
        currentQuestion: room.questions[room.game.questionIndex],
        questions: room.questions,
        questionIndex: room.game.questionIndex,
        players: room.players,
        defaultTimeLimit: room.defaultTimeLimit,
        durationMs: room.game.durationMs
      });
      
      if (room.game.goAt) {
        socket.emit('game:go', {
          goAt: room.game.goAt,
          startedAt: room.game.startedAt || room.game.goAt,
          durationMs: room.game.durationMs,
          serverTime: Date.now()
        });
      }
    }
    
    broadcastRoomState(io, roomCode, room);
  });

  socket.on('update-player-name', ({ roomCode, playerName }) => {
    const room = roomRepository.get(roomCode);
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon introuvable');
      return;
    }

    updatePlayerName(room, socket.id, playerName);
    roomRepository.update(roomCode, room);
    broadcastRoomState(io, roomCode, room);
  });

  socket.on('room:leave', ({ roomCode }) => {
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
  });

  socket.on('disconnect', () => {
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

