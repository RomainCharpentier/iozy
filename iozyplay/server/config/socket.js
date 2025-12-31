/**
 * Configuration de Socket.io
 */

import { Server } from 'socket.io';

export function createSocketServer(httpServer) {
  // Configuration CORS pour production et développement
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL 
        ? [process.env.FRONTEND_URL] 
        : true) // En production, accepter l'URL du frontend ou toutes si non définie
    : ['http://localhost:5173', 'http://localhost:3000'];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Configuration pour améliorer la fiabilité
    pingTimeout: 60000, // 60 secondes avant de considérer la connexion comme morte
    pingInterval: 25000, // Envoyer un ping toutes les 25 secondes
    transports: ['websocket', 'polling'], // Fallback sur polling si websocket échoue
    allowEIO3: true, // Compatibilité avec les anciennes versions
    // Gestion des reconnexions
    connectionStateRecovery: {
      // Sauvegarder l'état pour la reconnexion
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    }
  });

  // Logger les connexions/déconnexions pour le débogage
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connecté: ${socket.id}`);
    
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client déconnecté: ${socket.id}, raison: ${reason}`);
    });
    
    socket.on('error', (error) => {
      console.error(`[Socket] Erreur pour ${socket.id}:`, error);
    });
  });

  return io;
}





