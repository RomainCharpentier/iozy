/**
 * Gestionnaires d'événements Socket.io pour le jeu
 */

import { isHost, getRoomState, findPlayerBySocketId } from '../domain/room.js';
import { startGame, restartGameWithCategories, restartGame, checkAnswer, storeAnswer, validateAnswers, voteSkip, resetSkipVotes, nextQuestion, getGameState } from '../domain/game.js';
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
 * Synchronise un joueur qui rejoint une partie en cours
 */
function syncPlayerToGame(socket, room) {
  if (room.gameState !== 'playing' || !room.game) {
    return;
  }

  const gameStartData = {
    currentQuestion: room.questions[room.game.questionIndex],
    questions: room.questions,
    questionIndex: room.game.questionIndex,
    players: room.players,
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

  // Calculer le temps restant à partir de startedAt
  const now = Date.now();
  const elapsed = now - room.game.startedAt;
  const timeRemaining = Math.max(0, room.game.durationMs - elapsed);
  
  console.log('[scheduleNextQuestionTimer] Programmation du timer', {
    roomCode,
    startedAt: room.game.startedAt,
    now,
    elapsed,
    durationMs: room.game.durationMs,
    timeRemaining
  });

    const timer = setTimeout(() => {
    const currentRoom = roomRepository.get(roomCode);
    if (!currentRoom || currentRoom.gameState !== 'playing') return;
    
    console.log('[scheduleNextQuestionTimer] Phase guess terminée, validation des réponses et démarrage de la phase reveal', {
      roomCode,
      currentQuestionIndex: currentRoom.game.questionIndex
    });
    
    // Valider toutes les réponses stockées
    const validationResult = validateAnswers(currentRoom);
    if (validationResult.validated) {
      roomRepository.update(roomCode, currentRoom);
      
      // Envoyer les résultats de validation à tous les clients
      io.to(roomCode).emit('game:answers-validated', {
        validatedAnswers: validationResult.validatedAnswers,
        correctPlayers: validationResult.correctPlayers.map(p => p.id),
        players: validationResult.players
      });
    }
    
    // Réinitialiser les votes skip pour la phase reveal
    resetSkipVotes(currentRoom);
    roomRepository.update(roomCode, currentRoom);
    
    // Envoyer un événement pour indiquer que la phase reveal commence
    // Les clients démarrent immédiatement à la réception
    io.to(roomCode).emit('game:reveal', {
      questionIndex: currentRoom.game.questionIndex,
      durationMs: currentRoom.game.durationMs
    });
    
    // Attendre la durée de la phase reveal (même durée que le guess) avant de passer à la question suivante
    console.log('[scheduleNextQuestionTimer] Phase reveal - durée:', {
      roomCode,
      durationMs: currentRoom.game.durationMs,
      durationSeconds: currentRoom.game.durationMs / 1000,
      defaultTimeLimit: currentRoom.defaultTimeLimit
    });
    
    const revealTimer = setTimeout(() => {
      const revealRoom = roomRepository.get(roomCode);
      if (!revealRoom || revealRoom.gameState !== 'playing') return;
      
      console.log('[scheduleNextQuestionTimer] Phase reveal terminée, passage à la question suivante', {
        roomCode,
        currentQuestionIndex: revealRoom.game.questionIndex
      });
      
      const result = nextQuestion(revealRoom);
      if (!result) return;

      roomRepository.update(roomCode, result.room);
      roomRepository.clearGameTimer(roomCode);

      if (result.isFinished) {
        broadcastRoomState(io, roomCode, result.room);
        io.to(roomCode).emit('game:end', {
          players: result.players
        });
      } else {
        // Réinitialiser readyPlayers et votes skip pour la nouvelle question
        result.room.game.readyPlayers = new Set();
        result.room.game.goAt = null;
        result.room.game.startedAt = null;
        resetSkipVotes(result.room);
        
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
    }, room.game.durationMs); // Durée de la phase reveal (même durée que le guess)
    
    // Sauvegarder le timer de reveal (remplace le timer initial qui vient de se terminer)
    roomRepository.setGameTimer(roomCode, revealTimer);
  }, timeRemaining);
  
  // Sauvegarder le timer initial (pour la phase guess)
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
      syncPlayerToGame(socket, room);
    } else {
      socket.emit('game:state', { gameState: gameState.gameState });
    }
  });

  socket.on('game:ready', ({ roomCode }) => {
    console.log('[game:ready] Événement reçu', { roomCode, socketId: socket.id });
    
    const room = roomRepository.get(roomCode);
    if (!room?.game) {
      console.log('[game:ready] Room ou game non trouvé', { roomCode, hasRoom: !!room, hasGame: !!room?.game });
      return;
    }

    console.log('[game:ready] Joueurs dans la room', { 
      roomCode, 
      players: room.players.map(p => ({ id: p.id, socketId: p.socketId, name: p.name, connected: p.connected })),
      socketId: socket.id
    });

    const player = findPlayerBySocketId(room, socket.id);
    if (!player) {
      console.log('[game:ready] Joueur non trouvé par socketId', { 
        roomCode, 
        socketId: socket.id,
        players: room.players.map(p => ({ id: p.id, socketId: p.socketId, name: p.name }))
      });
      return;
    }

    console.log('[game:ready] Joueur prêt', { roomCode, playerId: player.id, playerName: player.name, socketId: socket.id });

    if (!(room.game.readyPlayers instanceof Set)) {
      room.game.readyPlayers = new Set();
    }
    room.game.readyPlayers.add(player.id);
    
    roomRepository.update(roomCode, room);
    
    const connectedPlayers = room.players.filter(p => p.connected);
    const readyPlayers = Array.from(room.game.readyPlayers || []);
    const allReady = connectedPlayers.length > 0 && 
                     connectedPlayers.every(p => room.game.readyPlayers.has(p.id));
    
    console.log('[game:ready] État de synchronisation', {
      roomCode,
      connectedPlayers: connectedPlayers.length,
      connectedPlayerIds: connectedPlayers.map(p => p.id),
      readyPlayers: readyPlayers.length,
      readyPlayerIds: readyPlayers,
      allReady,
      hasGoAt: !!room.game.goAt,
      check: connectedPlayers.map(p => ({ id: p.id, isReady: room.game.readyPlayers.has(p.id) }))
    });
    
    if (allReady && !room.game.goAt) {
      // Utiliser un délai plus court pour réduire la latence perçue tout en gardant la synchronisation
      const goAt = Date.now() + 1000; // Réduit de 1500ms à 1000ms pour une meilleure réactivité
      room.game.goAt = goAt;
      room.game.startedAt = goAt;
      
      console.log('[game:ready] ✅ Tous les joueurs sont prêts, envoi de game:go', { roomCode, goAt });
      
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
      console.log('[game:ready] ⏳ Pas encore tous prêts ou goAt déjà défini', { allReady, hasGoAt: !!room.game.goAt });
      broadcastRoomState(io, roomCode, room);
    }
  });

  socket.on('game:answer', ({ roomCode, answer }) => {
    const room = roomRepository.get(roomCode);
    if (!room) return;

    const player = findPlayerBySocketId(room, socket.id);
    if (!player) return;

    // Stocker la réponse sans la valider (validation à la fin du guess)
    const result = storeAnswer(room, socket.id, answer);
    
    if (!result.isValid) return;

    roomRepository.update(roomCode, room);

    // Informer le joueur que sa réponse a été stockée
    socket.emit('game:answer-stored', {
      playerId: player.id
    });
  });

  socket.on('game:skip-vote', ({ roomCode }) => {
    const room = roomRepository.get(roomCode);
    if (!room) {
      return;
    }

    // Vérifier que la partie est toujours en cours
    if (room.gameState !== 'playing') {
      return;
    }


    const player = findPlayerBySocketId(room, socket.id);
    if (!player) {
      return;
    }


    const result = voteSkip(room, socket.id);
    
    if (!result.voted) {
      return;
    }

    roomRepository.update(roomCode, room);


    // Informer tous les clients du vote
    io.to(roomCode).emit('game:skip-vote-updated', {
      playerId: player.id,
      skipVotes: result.skipVotes,
      allPlayersVoted: result.allPlayersVoted
    });

      // Si tous les joueurs ont voté skip
      if (result.allPlayersVoted) {
        // Si on est en phase guess, valider les réponses et passer au reveal
        // On est en phase guess si validatedAnswers n'existe pas ou n'a pas encore été validé
        // (on utilise le flag _validated pour distinguer un objet vide non validé d'un objet vide validé)
        const hasValidatedAnswers = !!room.game?.validatedAnswers;
        const hasValidatedFlag = room.game?.validatedAnswers?._validated === true;
        const isGuessPhase = !hasValidatedAnswers || !hasValidatedFlag;
      
      if (isGuessPhase) {
        
        // Annuler le timer de la phase guess avant de passer au reveal
        roomRepository.clearGameTimer(roomCode);
        
        // Phase guess : valider les réponses
        const validationResult = validateAnswers(room);
        if (validationResult.validated) {
          roomRepository.update(roomCode, room);
          
          
          io.to(roomCode).emit('game:answers-validated', {
            validatedAnswers: validationResult.validatedAnswers,
            correctPlayers: validationResult.correctPlayers.map(p => p.id),
            players: validationResult.players
          });
        }
        
        // Réinitialiser les votes skip pour la phase reveal
        resetSkipVotes(room);
        roomRepository.update(roomCode, room);
        
        // Passer à la phase reveal
        io.to(roomCode).emit('game:reveal', {
          questionIndex: room.game.questionIndex,
          durationMs: room.game.durationMs
        });
        
        // Programmer directement le timer pour la phase reveal (sans passer par scheduleNextQuestionTimer)
        // car on est déjà en phase reveal
        const revealDurationMs = room.game.durationMs;
        
        const revealTimer = setTimeout(() => {
          const revealRoom = roomRepository.get(roomCode);
          if (!revealRoom || revealRoom.gameState !== 'playing') return;
          
          
          const result = nextQuestion(revealRoom);
          if (!result) return;

          roomRepository.update(roomCode, result.room);
          roomRepository.clearGameTimer(roomCode);

          if (result.isFinished) {
            broadcastRoomState(io, roomCode, result.room);
            io.to(roomCode).emit('game:end', {
              players: result.players
            });
          } else {
            // Réinitialiser readyPlayers et votes skip pour la nouvelle question
            result.room.game.readyPlayers = new Set();
            result.room.game.goAt = null;
            result.room.game.startedAt = null;
            resetSkipVotes(result.room);
            
            roomRepository.update(roomCode, result.room);
            
            // Envoyer d'abord game:next, puis room:state pour synchroniser tous les clients
            io.to(roomCode).emit('game:next', {
              currentQuestion: result.currentQuestion,
              questions: result.room.questions,
              questionIndex: result.questionIndex,
              durationMs: result.room.game.durationMs
            });
            
            // Ensuite envoyer room:state pour forcer la synchronisation
            broadcastRoomState(io, roomCode, result.room);
          }
        }, revealDurationMs);
        
        roomRepository.setGameTimer(roomCode, revealTimer);
      } else {
        // Phase reveal : passer à la question suivante
        
        // Annuler le timer du reveal AVANT de passer à la question suivante
        roomRepository.clearGameTimer(roomCode);
        
        // Réinitialiser les votes skip avant de passer à la question suivante
        resetSkipVotes(room);
        roomRepository.update(roomCode, room);
        
        // Vérifier que room.gameState est bien 'playing' avant d'appeler nextQuestion
        if (room.gameState !== 'playing') {
          console.error('[game:skip-vote] Room gameState is not playing:', room.gameState);
          return;
        }
        

        const nextResult = nextQuestion(room);
        if (!nextResult) {
          return;
        }

        roomRepository.update(roomCode, nextResult.room);

        if (nextResult.isFinished) {
          broadcastRoomState(io, roomCode, nextResult.room);
          io.to(roomCode).emit('game:end', {
            players: nextResult.players
          });
        } else {
          // Réinitialiser readyPlayers et votes skip pour la nouvelle question
          nextResult.room.game.readyPlayers = new Set();
          nextResult.room.game.goAt = null;
          nextResult.room.game.startedAt = null;
          resetSkipVotes(nextResult.room);
          
          roomRepository.update(roomCode, nextResult.room);
          
          io.to(roomCode).emit('game:next', {
            currentQuestion: nextResult.currentQuestion,
            questions: nextResult.room.questions,
            questionIndex: nextResult.questionIndex,
            durationMs: nextResult.room.game.durationMs
          });
          
          // Envoyer room:state pour forcer la synchronisation
          broadcastRoomState(io, roomCode, nextResult.room);
        }
      }
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

