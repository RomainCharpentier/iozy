/**
 * Point d'entrée du serveur
 */

import { createServer } from 'http';
import { createExpressApp } from './config/server.js';
import { createSocketServer } from './config/socket.js';
import { setupRoomHandlers } from './handlers/roomHandlers.js';
import { setupGameHandlers } from './handlers/gameHandlers.js';

/** '' pour la racine ; sinon un seul `/` devant, aucun derrière : `play`, `/play/` et `/play` valent `/play`. */
function normaliserPrefixe(valeur) {
    const sans = (valeur || '').trim().replace(/^\/+|\/+$/g, '');
    return sans ? `/${sans}` : '';
}

// Le préfixe sous lequel tout est servi : vide à la racine (dev, Vercel avec
// un serveur à part), `/play` quand IozyPlay vit à côté d'IozyCore derrière le
// même nginx. Le front est construit avec la même valeur (vite.config.ts).
const basePath = normaliserPrefixe(process.env.IOZYPLAY_BASE_PATH);
// Le dossier du front construit, servi par ce serveur (image Docker) ; absent
// en dev, où Vite sert le front.
const staticDir = process.env.IOZYPLAY_STATIC_DIR || null;

// Créer l'application Express
const app = createExpressApp({ basePath, staticDir });
const httpServer = createServer(app);

// Créer le serveur Socket.io
const io = createSocketServer(httpServer, { basePath });

io.on('connection', (socket) => {
    setupRoomHandlers(socket, io);
    setupGameHandlers(socket, io);
});

// Démarrer le serveur
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}${basePath ? ` sous ${basePath}` : ''}`);
    console.log(`📡 Socket.io prêt pour les connexions`);
});
