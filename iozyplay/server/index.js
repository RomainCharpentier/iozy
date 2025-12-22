/**
 * Point d'entrée du serveur
 */

import { createServer } from 'http';
import { createExpressApp } from './config/server.js';
import { createSocketServer } from './config/socket.js';
import { setupRoomHandlers } from './handlers/roomHandlers.js';
import { setupGameHandlers } from './handlers/gameHandlers.js';

// Créer l'application Express
const app = createExpressApp();
const httpServer = createServer(app);

// Créer le serveur Socket.io
const io = createSocketServer(httpServer);

io.on('connection', (socket) => {
    setupRoomHandlers(socket, io);
    setupGameHandlers(socket, io);
});

// Démarrer le serveur
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📡 Socket.io prêt pour les connexions`);
});
