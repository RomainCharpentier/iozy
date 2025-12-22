/**
 * Gestionnaires d'événements Socket.io pour le jeu
 */

import { isHost, getRoomState, findPlayerBySocketId } from '../domain/room.js';
import { startGame, restartGameWithCategories, restartGame, checkAnswer, nextQuestion, getGameState } from '../domain/game.js';
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

/**
 * Programme le timer automatique pour passer à la question suivante
 */
function scheduleNextQuestionTimer(io, roomCode, room) {
  if (!room || !room.game || room.gameState !== 'playing') return;
  
  // Ne programmer le timer que si startedAt est défini (après le "go")
  if (!room.game.startedAt) return;

  const timer = setTimeout(() => {
    const currentRoom = roomRepository.get(roomCode);
    if (!currentRoom || currentRoom.gameState !== 'playing') return;
    
    const result = nextQuestion(currentRoom);
    if (!result) return;

    roomRepository.update(roomCode, result.room);
    roomRepository.clearGameTimer(roomCode);

    if (result.isFinished) {
      broadcastRoomState(io, roomCode, result.room);
      io.to(roomCode).emit('game:end', {
        players: result.players
      });
    } else {
      // Réinitialiser readyPlayers pour la nouvelle question
      result.room.game.readyPlayers = new Set();
      result.room.game.goAt = null;
      result.room.game.startedAt = null;
      
      roomRepository.update(roomCode, result.room);
      
      // Pas de timeout de sécurité - on attend vraiment que tous soient prêts pour la nouvelle question
      
      // Envoyer d'abord game:next, puis room:state pour synchroniser tous les clients
      io.to(roomCode).emit('game:next', {
        currentQuestion: result.currentQuestion,
        questions: result.room.questions,
        questionIndex: result.questionIndex,
        durationMs: result.room.game.durationMs
        // startedAt sera défini au moment du "go"
      });
      
      // Ensuite envoyer room:state pour forcer la synchronisation
      broadcastRoomState(io, roomCode, result.room);
      
      // Ne pas programmer le timer maintenant, attendre que tous soient prêts
    }
  }, room.game.durationMs);
  
  roomRepository.setGameTimer(roomCode, timer);
}

export function setupGameHandlers(socket, io) {
  socket.on('game:start', async ({ roomCode, questions, defaultTimeLimit }) => {
    const room = roomRepository.get(roomCode);
    
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon non trouvé');
      return;
    }
    
    if (!isHost(room, socket.id)) {
      sendError(socket, 'UNAUTHORIZED', 'Seul l\'hôte peut démarrer la partie');
      return;
    }

    if (!questions || questions.length === 0) {
      sendError(socket, 'NO_QUESTIONS', 'Aucune question disponible');
      return;
    }

    // Nettoyer les timers précédents
    roomRepository.clearGameTimer(roomCode);

    startGame(room, questions, defaultTimeLimit);
    roomRepository.update(roomCode, room);
    
    // Envoyer l'état de démarrage (sans startedAt, sera défini au "go")
    const gameStartedData = {
      currentQuestion: questions[0],
      questions: questions,
      questionIndex: 0,
      players: room.players,
      defaultTimeLimit: room.defaultTimeLimit,
      durationMs: room.game.durationMs
    };
    
    broadcastRoomState(io, roomCode, room);
    io.to(roomCode).emit('game:start', gameStartedData);
    
    // Pas de timeout de sécurité - on attend vraiment que tous les joueurs soient prêts
  });

  socket.on('game:restart-with-categories', async ({ roomCode, questions, categories, defaultTimeLimit }) => {
    const room = roomRepository.get(roomCode);
    
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon non trouvé');
      return;
    }
    
    if (!isHost(room, socket.id)) {
      sendError(socket, 'UNAUTHORIZED', 'Seul l\'hôte peut relancer la partie');
      return;
    }
    
    if (!questions || questions.length === 0) {
      sendError(socket, 'NO_QUESTIONS', 'Aucune question disponible');
      return;
    }

    // Nettoyer les timers précédents
    roomRepository.clearGameTimer(roomCode);
    
    restartGameWithCategories(room, questions, categories, defaultTimeLimit);
    roomRepository.update(roomCode, room);
    
    // Programmer le timer
    scheduleNextQuestionTimer(io, roomCode, room);
    
    const gameStartedData = {
      currentQuestion: room.questions[0],
      questions: room.questions,
      questionIndex: 0,
      players: room.players,
      defaultTimeLimit: room.defaultTimeLimit,
      durationMs: room.game.durationMs
    };
    
    broadcastRoomState(io, roomCode, room);
    io.to(roomCode).emit('game:start', gameStartedData);
  });

  socket.on('game:restart', ({ roomCode }) => {
    const room = roomRepository.get(roomCode);
    
    if (!room) {
      sendError(socket, 'ROOM_NOT_FOUND', 'Salon non trouvé');
      return;
    }
    
    if (!isHost(room, socket.id)) {
      sendError(socket, 'UNAUTHORIZED', 'Seul l\'hôte peut relancer la partie');
      return;
    }
    
    if (!room.questions || room.questions.length === 0) {
      sendError(socket, 'NO_QUESTIONS', 'Aucune question disponible');
      return;
    }

    // Nettoyer les timers précédents
    roomRepository.clearGameTimer(roomCode);
    
    restartGame(room);
    roomRepository.update(roomCode, room);
    
    // Programmer le timer
    scheduleNextQuestionTimer(io, roomCode, room);
    
    const gameStartedData = {
      currentQuestion: room.questions[0],
      questions: room.questions,
      questionIndex: 0,
      players: room.players,
      defaultTimeLimit: room.defaultTimeLimit,
      durationMs: room.game.durationMs
    };
    
    broadcastRoomState(io, roomCode, room);
    io.to(roomCode).emit('game:start', gameStartedData);
  });

  socket.on('game:get-state', ({ roomCode }) => {
    const room = roomRepository.get(roomCode);
    
    if (!room) {
      socket.emit('game:state', { gameState: 'waiting' });
      return;
    }
    
    const gameState = getGameState(room);
    const roomState = getRoomState(room);
    
    // Envoyer l'état complet de la room
    socket.emit('room:state', roomState);
    
    if (gameState.gameState === 'playing') {
      socket.emit('game:start', {
        currentQuestion: gameState.currentQuestion,
        questions: room.questions,
        questionIndex: gameState.questionIndex,
        players: gameState.players,
        defaultTimeLimit: gameState.defaultTimeLimit,
        durationMs: gameState.game?.durationMs
      });
      
      if (room.game.goAt) {
        socket.emit('game:go', {
          goAt: room.game.goAt,
          startedAt: room.game.startedAt || room.game.goAt,
          durationMs: room.game.durationMs,
          serverTime: Date.now()
        });
      }
    } else {
      socket.emit('game:state', { gameState: gameState.gameState });
    }
  });

  socket.on('game:ready', ({ roomCode }) => {
    const room = roomRepository.get(roomCode);
    if (!room?.game) return;

    const player = findPlayerBySocketId(room, socket.id);
    if (!player) return;

    if (!(room.game.readyPlayers instanceof Set)) {
      room.game.readyPlayers = new Set();
    }
    room.game.readyPlayers.add(player.id);
    
    roomRepository.update(roomCode, room);
    
    const connectedPlayers = room.players.filter(p => p.connected);
    const allReady = connectedPlayers.length > 0 && 
                     connectedPlayers.every(p => room.game.readyPlayers.has(p.id));
    
    if (allReady && !room.game.goAt) {
      const goAt = Date.now() + 1500;
      room.game.goAt = goAt;
      room.game.startedAt = goAt;
      
      roomRepository.update(roomCode, room);
      scheduleNextQuestionTimer(io, roomCode, room);
      broadcastRoomState(io, roomCode, room);
      
      io.to(roomCode).emit('game:go', {
        goAt: goAt,
        startedAt: goAt,
        durationMs: room.game.durationMs,
        serverTime: Date.now()
      });
    } else {
      broadcastRoomState(io, roomCode, room);
    }
  });

  socket.on('game:answer', ({ roomCode, answer }) => {
    const room = roomRepository.get(roomCode);
    if (!room) return;

    const player = findPlayerBySocketId(room, socket.id);
    if (!player) return;

    const result = checkAnswer(room, socket.id, answer);
    
    if (!result.isValid) return;

    roomRepository.update(roomCode, room);

    if (result.isCorrect) {
      broadcastRoomState(io, roomCode, room);
      io.to(roomCode).emit('game:correct-answer', {
        playerId: player.id,
        playerName: result.player.name,
        score: result.player.score,
        players: room.players
      });
    } else {
      socket.emit('game:incorrect-answer');
    }
  });

  socket.on('game:next', ({ roomCode }) => {
    const room = roomRepository.get(roomCode);
    if (!room) return;

    if (!isHost(room, socket.id)) {
      sendError(socket, 'UNAUTHORIZED', 'Seul l\'hôte peut passer à la question suivante');
      return;
    }

    // Nettoyer le timer automatique
    roomRepository.clearGameTimer(roomCode);

    const result = nextQuestion(room);
    if (!result) return;

    roomRepository.update(roomCode, result.room);

    if (result.isFinished) {
      broadcastRoomState(io, roomCode, result.room);
      io.to(roomCode).emit('game:end', {
        players: result.players
      });
    } else {
      // Programmer le timer pour la nouvelle question
      scheduleNextQuestionTimer(io, roomCode, result.room);
      
      broadcastRoomState(io, roomCode, result.room);
      io.to(roomCode).emit('game:next', {
        currentQuestion: result.currentQuestion,
        questionIndex: result.questionIndex,
        startedAt: result.room.game.startedAt,
        durationMs: result.room.game.durationMs
      });
    }
  });
}

