import { io, Socket } from 'socket.io-client'
import { getPlayerId } from '@/utils/playerId'
import { getSessionToken } from '@/utils/sessionToken'

const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3001'
  }
  console.error("[Socket] VITE_SOCKET_URL n'est pas définie en production !")
  throw new Error('VITE_SOCKET_URL must be defined in production')
}

let socket: Socket | null = null

// Vrai dès que le socket courant a été connecté au moins une fois :
// tout `connect` suivant est une reconnexion
let hasConnectedOnce = false

// Room active côté client (création, jonction ou partie en cours).
// Sert à émettre `room:rejoin` automatiquement après une reconnexion.
let currentRoomCode: string | null = null

const eventQueue: Array<{ event: string; data: any; timestamp: number }> = []

/**
 * Définit la room active. Appelé à la création, à la jonction et au chargement d'une partie.
 */
export const setCurrentRoom = (roomCode: string | null): void => {
  currentRoomCode = roomCode
}

/**
 * Oublie la room active. Si `roomCode` est fourni, n'efface que si c'est bien la room courante
 * (évite qu'un démontage tardif efface la room d'un écran plus récent).
 */
export const clearCurrentRoom = (roomCode?: string | null): void => {
  if (roomCode === undefined || roomCode === null || roomCode === currentRoomCode) {
    currentRoomCode = null
  }
}

export const getCurrentRoom = (): string | null => currentRoomCode

const handleConnect = () => {
  const isReconnect = hasConnectedOnce
  hasConnectedOnce = true
  console.log('[Socket] Connecté au serveur:', socket?.id, isReconnect ? '(reconnexion)' : '')

  // Après une reconnexion, toujours réintégrer la room : même si le socket.id est conservé
  // (connectionStateRecovery), le serveur a mis socketId = null sur le joueur
  if (isReconnect && currentRoomCode && socket) {
    socket.emit('room:rejoin', {
      roomCode: currentRoomCode,
      playerId: getPlayerId(),
      sessionToken: getSessionToken(currentRoomCode),
    })
  }

  if (eventQueue.length > 0) {
    console.log(`[Socket] Réenvoi de ${eventQueue.length} événements en queue`)
    eventQueue.forEach(({ event, data }) => {
      if (socket?.connected) {
        socket.emit(event, data)
      }
    })
    eventQueue.length = 0
  }
}

/**
 * Retourne le socket singleton, en le créant si nécessaire. Idempotent : une instance existante
 * (connectée ou en cours de connexion) est toujours réutilisée.
 */
export const connectSocket = (): Socket => {
  if (socket) {
    // Socket déconnecté manuellement (disconnect()) : il ne se reconnecte pas tout seul
    if (!socket.connected && !socket.active) {
      socket.connect()
    }
    return socket
  }

  hasConnectedOnce = false
  const s = io(getSocketUrl(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 20000,
    auth: {},
  })
  socket = s

  s.on('connect', handleConnect)

  s.on('disconnect', (reason) => {
    console.log('[Socket] Déconnecté du serveur:', reason)

    if (reason === 'io server disconnect') {
      s.connect()
    }
  })

  s.on('error', (error) => {
    console.error('[Socket] Erreur:', error)
  })

  // Les événements de reconnexion sont émis par le Manager, pas par le Socket
  s.io.on('reconnect_attempt', (attemptNumber) => {
    console.log(`[Socket] Tentative de reconnexion #${attemptNumber}`)
  })

  s.io.on('reconnect_error', (error) => {
    console.error('[Socket] Erreur de reconnexion:', error)
  })

  s.io.on('reconnect_failed', () => {
    console.error('[Socket] Échec de la reconnexion après toutes les tentatives')
  })

  return s
}

export const emitWithQueue = (event: string, data: any) => {
  const socket = getSocket()
  if (socket && socket.connected) {
    socket.emit(event, data)
  } else {
    eventQueue.push({
      event,
      data,
      timestamp: Date.now(),
    })
    console.log(`[Socket] Événement ajouté à la queue: ${event}`)

    if (socket && !socket.connected) {
      socket.connect()
    }
  }
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    eventQueue.length = 0
  }
  hasConnectedOnce = false
  currentRoomCode = null
}

export const getSocket = (): Socket | null => {
  return socket
}

export const isSocketConnected = (): boolean => {
  return socket !== null && socket.connected
}

export const disconnectSocketIfConnected = (): void => {
  // Déconnexion volontaire : on quitte aussi la room active
  currentRoomCode = null
  if (socket && socket.connected) {
    socket.disconnect()
  }
}
