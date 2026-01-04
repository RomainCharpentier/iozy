import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  console.error('[Socket] VITE_SOCKET_URL n\'est pas définie en production !');
  throw new Error('VITE_SOCKET_URL must be defined in production');
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

const eventQueue: Array<{ event: string; data: any; timestamp: number }> = [];

export const connectSocket = (): Socket => {
  if (!socket || !socket.connected) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      auth: {},
    });

    socket.on('connect', () => {
      console.log('[Socket] Connecté au serveur:', socket?.id);

      if (eventQueue.length > 0) {
        console.log(`[Socket] Réenvoi de ${eventQueue.length} événements en queue`);
        eventQueue.forEach(({ event, data }) => {
          if (socket?.connected) {
            socket.emit(event, data);
          }
        });
        eventQueue.length = 0;
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Déconnecté du serveur:', reason);

      if (reason === 'io server disconnect' && socket) {
        socket.connect();
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnecté après ${attemptNumber} tentatives`);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Tentative de reconnexion #${attemptNumber}`);
    });

    socket.on('reconnect_error', (error) => {
      console.error('[Socket] Erreur de reconnexion:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket] Échec de la reconnexion après toutes les tentatives');
    });

    socket.on('error', (error) => {
      console.error('[Socket] Erreur:', error);
    });
  }
  return socket;
};

export const emitWithQueue = (event: string, data: any) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit(event, data);
  } else {
    eventQueue.push({
      event,
      data,
      timestamp: Date.now()
    });
    console.log(`[Socket] Événement ajouté à la queue: ${event}`);

    if (socket && !socket.connected) {
      socket.connect();
    }
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    eventQueue.length = 0;
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const isSocketConnected = (): boolean => {
  return socket !== null && socket.connected;
};

export const disconnectSocketIfConnected = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};





