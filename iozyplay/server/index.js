import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Stockage des salons en mémoire (en production, utiliser Redis ou une DB)
const rooms = new Map();

// Générer un code de salon unique
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Routes API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);

  // Créer un salon
  socket.on('create-room', ({ playerName, categories }) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      players: [{
        id: socket.id,
        name: playerName || 'Hôte',
        score: 0,
        isHost: true
      }],
      categories,
      questions: [],
      currentQuestionIndex: 0,
      gameState: 'waiting', // waiting, playing, finished
      createdAt: Date.now()
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    
    socket.emit('room-created', { roomCode, room });
    console.log(`Salon créé: ${roomCode} par ${playerName || 'Hôte'}`);
  });

  // Mettre à jour le nom d'un joueur
  socket.on('update-player-name', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('room-error', { message: 'Salon introuvable' });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.name = playerName;
      io.to(roomCode).emit('player-name-updated', { players: room.players });
      console.log(`Nom mis à jour pour ${socket.id}: ${playerName}`);
    }
  });

  // Rejoindre un salon
  socket.on('join-room', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('room-error', { message: 'Salon introuvable' });
      return;
    }

    if (room.gameState !== 'waiting') {
      socket.emit('room-error', { message: 'La partie a déjà commencé' });
      return;
    }

    // Vérifier si le joueur existe déjà
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (existingPlayer) {
      socket.emit('room-joined', { room });
      socket.join(roomCode);
      io.to(roomCode).emit('player-joined', { 
        player: { id: socket.id, name: playerName, score: 0 },
        players: room.players 
      });
      return;
    }

    // Ajouter le joueur
    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      isHost: false
    };
    
    room.players.push(player);
    socket.join(roomCode);
    
    socket.emit('room-joined', { room });
    io.to(roomCode).emit('player-joined', { player, players: room.players });
    console.log(`${playerName} a rejoint le salon ${roomCode}`);
  });

  // Démarrer la partie
  socket.on('start-game', async ({ roomCode, questions }) => {
    console.log(`[BACKEND] ===== START-GAME REÇU =====`, {
      roomCode,
      questionsCount: questions?.length || 0,
      socketId: socket.id
    });
    
    const room = rooms.get(roomCode);
    
    if (!room) {
      console.error(`[BACKEND] ❌ Salon ${roomCode} non trouvé`);
      socket.emit('room-error', { message: 'Salon non trouvé' });
      return;
    }
    
    if (room.host !== socket.id) {
      console.error(`[BACKEND] ❌ Action non autorisée: host=${room.host}, socket=${socket.id}`);
      socket.emit('room-error', { message: 'Action non autorisée' });
      return;
    }

    console.log(`[BACKEND] ✅ Validation OK, démarrage de la partie`);
    room.questions = questions;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    
    console.log(`[BACKEND] ===== ÉMISSION DE game-started =====`, {
      roomCode,
      playersCount: room.players.length,
      questionsCount: questions.length,
      firstQuestion: questions[0]?.id || questions[0]?.answer,
      hostSocketId: socket.id
    });
    
    // Émettre à tous les sockets dans la room
    try {
      const socketsInRoom = await io.in(roomCode).fetchSockets();
      console.log(`[BACKEND] Sockets dans la room ${roomCode}:`, socketsInRoom.map(s => s.id));
    } catch (err) {
      console.error(`[BACKEND] Erreur lors de la récupération des sockets:`, err);
    }
    
    io.to(roomCode).emit('game-started', { 
      currentQuestion: questions[0],
      questionIndex: 0,
      players: room.players
    });
    
    // Émettre aussi directement à l'hôte au cas où il ne serait plus dans la room
    socket.emit('game-started', {
      currentQuestion: questions[0],
      questionIndex: 0,
      players: room.players
    });
    
    console.log(`[BACKEND] ✅ game-started émis à ${room.players.length} joueur(s) dans le salon ${roomCode} + directement à l'hôte`);
  });
  
  // Relancer la partie avec de nouvelles catégories
  socket.on('restart-game-with-categories', async ({ roomCode, questions, categories }) => {
    console.log(`[BACKEND] ===== RESTART-GAME-WITH-CATEGORIES REÇU =====`, { roomCode, socketId: socket.id, questionsCount: questions?.length });
    const room = rooms.get(roomCode);
    
    if (!room) {
      console.error(`[BACKEND] ❌ Salon ${roomCode} non trouvé pour restart-with-categories`);
      socket.emit('room-error', { message: 'Salon non trouvé' });
      return;
    }
    
    if (room.host !== socket.id) {
      console.error(`[BACKEND] ❌ Action non autorisée pour restart-with-categories: host=${room.host}, socket=${socket.id}`);
      socket.emit('room-error', { message: 'Seul l\'hôte peut relancer la partie' });
      return;
    }
    
    console.log(`[BACKEND] ✅ Relance avec nouveaux thèmes dans le salon ${roomCode}`);
    
    // Mettre à jour les questions et catégories
    room.questions = questions;
    room.categories = categories;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    
    // Réinitialiser les scores des joueurs
    room.players.forEach(player => {
      player.score = 0;
    });
    
    // Émettre game-started pour redémarrer la partie
    if (room.questions && room.questions.length > 0) {
      io.to(roomCode).emit('game-started', {
        currentQuestion: room.questions[0],
        questionIndex: 0,
        players: room.players
      });
      
      // Émettre aussi directement à l'hôte
      socket.emit('game-started', {
        currentQuestion: room.questions[0],
        questionIndex: 0,
        players: room.players
      });
      
      console.log(`[BACKEND] ✅ Partie relancée avec nouveaux thèmes dans le salon ${roomCode}`);
    } else {
      console.error(`[BACKEND] ❌ Aucune question disponible pour relancer la partie`);
      socket.emit('room-error', { message: 'Aucune question disponible' });
    }
  });
  
  // Relancer la partie dans un salon
  socket.on('restart-game', ({ roomCode }) => {
    console.log(`[BACKEND] ===== RESTART-GAME REÇU =====`, { roomCode, socketId: socket.id });
    const room = rooms.get(roomCode);
    
    if (!room) {
      console.error(`[BACKEND] ❌ Salon ${roomCode} non trouvé pour restart`);
      socket.emit('room-error', { message: 'Salon non trouvé' });
      return;
    }
    
    if (room.host !== socket.id) {
      console.error(`[BACKEND] ❌ Action non autorisée pour restart: host=${room.host}, socket=${socket.id}`);
      socket.emit('room-error', { message: 'Seul l\'hôte peut relancer la partie' });
      return;
    }
    
    console.log(`[BACKEND] ✅ Relance de la partie dans le salon ${roomCode}`);
    
    // Réinitialiser l'état de la partie
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    
    // Réinitialiser les scores des joueurs
    room.players.forEach(player => {
      player.score = 0;
    });
    
    // Émettre game-started pour redémarrer la partie
    if (room.questions && room.questions.length > 0) {
      io.to(roomCode).emit('game-started', {
        currentQuestion: room.questions[0],
        questionIndex: 0,
        players: room.players
      });
      
      // Émettre aussi directement à l'hôte
      socket.emit('game-started', {
        currentQuestion: room.questions[0],
        questionIndex: 0,
        players: room.players
      });
      
      console.log(`[BACKEND] ✅ Partie relancée dans le salon ${roomCode}`);
    } else {
      console.error(`[BACKEND] ❌ Aucune question disponible pour relancer la partie`);
      socket.emit('room-error', { message: 'Aucune question disponible' });
    }
  });
  
  // Demander l'état de la partie (au cas où le client arrive après le démarrage)
  socket.on('get-game-state', ({ roomCode }) => {
    console.log(`[BACKEND] ===== GET-GAME-STATE REÇU =====`, { roomCode, socketId: socket.id });
    const room = rooms.get(roomCode);
    if (!room) {
      console.log(`[BACKEND] ❌ Salon ${roomCode} non trouvé pour get-game-state`);
      socket.emit('game-state', { gameState: 'waiting' });
      return;
    }
    
    console.log(`[BACKEND] État du salon:`, {
      gameState: room.gameState,
      questionsCount: room.questions?.length || 0,
      currentQuestionIndex: room.currentQuestionIndex,
      playersCount: room.players.length
    });
    
    if (room.gameState === 'playing' && room.questions && room.questions.length > 0) {
      console.log(`[BACKEND] ✅ Partie en cours, envoi de game-started au client`);
      socket.emit('game-started', {
        currentQuestion: room.questions[room.currentQuestionIndex],
        questionIndex: room.currentQuestionIndex,
        players: room.players
      });
    } else {
      console.log(`[BACKEND] ⏳ Partie pas encore démarrée, état: ${room.gameState || 'waiting'}`);
      socket.emit('game-state', { gameState: room.gameState || 'waiting' });
    }
  });

  // Réponse d'un joueur
  socket.on('player-answer', ({ roomCode, answer, timeRemaining }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!currentQuestion) return;

    const isCorrect = answer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim();
    
    if (isCorrect) {
      player.score += 1;
      io.to(roomCode).emit('correct-answer', {
        playerId: socket.id,
        playerName: player.name,
        score: player.score,
        timeRemaining,
        players: room.players // Envoyer la liste complète des joueurs pour synchronisation
      });
    } else {
      socket.emit('incorrect-answer');
    }
  });

  // Temps écoulé
  socket.on('time-up', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    // Passer à la question suivante après un délai
    setTimeout(() => {
      room.currentQuestionIndex += 1;
      
      if (room.currentQuestionIndex >= room.questions.length) {
        // Fin de la partie
        room.gameState = 'finished';
        io.to(roomCode).emit('game-ended', {
          players: room.players.sort((a, b) => b.score - a.score)
        });
      } else {
        // Question suivante
        io.to(roomCode).emit('next-question', {
          currentQuestion: room.questions[room.currentQuestionIndex],
          questionIndex: room.currentQuestionIndex
        });
      }
    }, 5000);
  });

  // Question suivante (après bonne réponse)
  socket.on('next-question', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    setTimeout(() => {
      room.currentQuestionIndex += 1;
      
      if (room.currentQuestionIndex >= room.questions.length) {
        room.gameState = 'finished';
        io.to(roomCode).emit('game-ended', {
          players: room.players.sort((a, b) => b.score - a.score)
        });
      } else {
        io.to(roomCode).emit('next-question', {
          currentQuestion: room.questions[room.currentQuestionIndex],
          questionIndex: room.currentQuestionIndex
        });
      }
    }, 3000);
  });

  // Quitter un salon explicitement
  socket.on('leave-room', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      room.players.splice(playerIndex, 1);
      socket.leave(roomCode);
      
      // Si c'était l'hôte et qu'il reste des joueurs, transférer l'hôte
      if (room.host === socket.id && room.players.length > 0) {
        room.host = room.players[0].id;
        room.players[0].isHost = true;
        io.to(roomCode).emit('host-transferred', { newHost: room.players[0] });
      }
      
      // Si plus de joueurs, supprimer le salon
      if (room.players.length === 0) {
        rooms.delete(roomCode);
        console.log(`Salon ${roomCode} supprimé (plus de joueurs)`);
      } else {
        io.to(roomCode).emit('player-left', {
          playerId: socket.id,
          players: room.players
        });
      }
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
    
    // Retirer le joueur de tous les salons
    rooms.forEach((room, roomCode) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // Si c'était l'hôte et qu'il reste des joueurs, transférer l'hôte
        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
          room.players[0].isHost = true;
          io.to(roomCode).emit('host-transferred', { newHost: room.players[0] });
        }
        
        // Si plus de joueurs, supprimer le salon
        if (room.players.length === 0) {
          rooms.delete(roomCode);
          console.log(`Salon ${roomCode} supprimé (plus de joueurs)`);
        } else {
          io.to(roomCode).emit('player-left', {
            playerId: socket.id,
            players: room.players
          });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 Socket.io prêt pour les connexions`);
});

