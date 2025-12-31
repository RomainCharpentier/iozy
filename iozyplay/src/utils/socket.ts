import { io, Socket } from 'socket.io-client';

// En production, VITE_SOCKET_URL doit être définie
// En développement, fallback sur localhost
const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // En développement uniquement
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  // En production, si VITE_SOCKET_URL n'est pas définie, afficher une erreur
  console.error('[Socket] VITE_SOCKET_URL n\'est pas définie en production !');
  throw new Error('VITE_SOCKET_URL must be defined in production');
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

// Queue d'événements pour les messages perdus pendant la déconnexion
const eventQueue: Array<{ event: string; data: any; timestamp: number }> = [];

export const connectSocket = (): Socket => {
  if (!socket || !socket.connected) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Essayer websocket d'abord, fallback sur polling
      reconnection: true,
      reconnectionAttempts: Infinity, // Réessayer indéfiniment
      reconnectionDelay: 1000, // Démarrer à 1 seconde
      reconnectionDelayMax: 5000, // Maximum 5 secondes entre les tentatives
      randomizationFactor: 0.5, // Ajouter de la randomisation pour éviter le thundering herd
      timeout: 20000, // Timeout de connexion de 20 secondes
      // Gestion de la reconnexion avec récupération d'état
      auth: {
        // Vous pouvez ajouter des données d'authentification ici si nécessaire
      },
    });

    // Gestion des événements de connexion
    socket.on('connect', () => {
      console.log('[Socket] Connecté au serveur:', socket?.id);
      
      // Réenvoyer les événements en queue après reconnexion
      if (eventQueue.length > 0) {
        console.log(`[Socket] Réenvoi de ${eventQueue.length} événements en queue`);
        eventQueue.forEach(({ event, data }) => {
          if (socket?.connected) {
            socket.emit(event, data);
          }
        });
        eventQueue.length = 0; // Vider la queue
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Déconnecté du serveur:', reason);
      
      // Si la déconnexion n'est pas volontaire, préparer la reconnexion
      if (reason === 'io server disconnect' && socket) {
        // Le serveur a forcé la déconnexion, reconnecter manuellement
        socket.connect();
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnecté après ${attemptNumber} tentatives`);
    });

    // socket est garanti non-null ici car on vient de le créer
    if (!socket) {
      throw new Error('Failed to create socket connection');
    }

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Tentative de reconnexion #${attemptNumber}`);
    });

    socket.on('reconnect_error', (error) => {
      console.error('[Socket] Erreur de reconnexion:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket] Échec de la reconnexion après toutes les tentatives');
      // Vous pouvez implémenter une logique de fallback ici
    });

    socket.on('error', (error) => {
      console.error('[Socket] Erreur:', error);
    });
  }
  return socket;
};

// Fonction helper pour émettre avec queue automatique
export const emitWithQueue = (event: string, data: any) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit(event, data);
  } else {
    // Ajouter à la queue si déconnecté
    eventQueue.push({
      event,
      data,
      timestamp: Date.now()
    });
    console.log(`[Socket] Événement ajouté à la queue: ${event}`);
    
    // Tenter de se reconnecter si pas déjà en cours
    if (socket && !socket.connected) {
      socket.connect();
    }
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    eventQueue.length = 0; // Vider la queue
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

// Fonction pour vérifier si le socket est connecté
export const isSocketConnected = (): boolean => {
  return socket !== null && socket.connected;
};





