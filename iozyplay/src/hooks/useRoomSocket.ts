import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import { connectSocket, getSocket, setCurrentRoom, clearCurrentRoom } from '@/utils/socket'
import { getPlayerId } from '@/utils/playerId'
import { getSessionToken, setSessionToken } from '@/utils/sessionToken'
import { getLocalPlayerAvatar } from '@/utils/playerAvatar'
import type { Player } from '@/lib/game/types'
import { TIMING } from '@/services/gameService'

export interface UseRoomSocketJoinParams {
  mode: 'join'
  roomCode: string
  playerName: string
  enabled: boolean
  onJoined: (roomCode: string) => void
  onJoinedSuccess?: () => void
  onGameStart?: () => void
  onError?: (code: string, message: string) => void
}

export interface UseRoomSocketJoinResult {
  players: Player[]
  isHost: boolean
  gameStarted: boolean
  leaveRoom: () => void
}

export interface UseRoomSocketCreateParams {
  mode: 'create'
  categories: string[]
  playerName: string
  timeLimit: number
  enabled: boolean
  /** Si true, ne pas émettre room:leave au démontage (ex: démarrage de partie) */
  skipLeaveOnUnmountRef?: MutableRefObject<boolean>
  /** Appelé quand le salon est créé (son, sync playerName, etc.) */
  onRoomCreated?: (roomCode: string, room: { players?: Player[] }) => void
  onError?: (code: string, message: string) => void
}

export interface UseRoomSocketCreateResult {
  roomCode: string | null
  players: Player[]
  shareLink: string
  currentPlayerName: string
  isConnecting: boolean
  error: string | null
  leaveRoom: () => void
}

export type UseRoomSocketParams = UseRoomSocketJoinParams | UseRoomSocketCreateParams
export type UseRoomSocketResult = UseRoomSocketJoinResult | UseRoomSocketCreateResult

/**
 * Garde dans une ref la dernière version des callbacks, pour ne pas relancer les effets
 * quand le parent passe des fonctions inline.
 */
function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

export function useRoomSocketJoin(
  params: Omit<UseRoomSocketJoinParams, 'mode'> & { mode?: 'join' }
): UseRoomSocketJoinResult {
  const { roomCode, playerName, enabled, onJoined, onJoinedSuccess, onGameStart, onError } = params
  const callbacksRef = useLatestRef({ onJoined, onJoinedSuccess, onGameStart, onError })
  const trimmedName = playerName.trim()
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const gameStartedRef = useRef(false)
  // Vrai quand on bascule vers /game : le démontage du lobby ne doit alors PAS quitter le salon
  // (sinon le serveur retire le joueur, et /game le recrée sans son nom ni son score)
  const navigatingToGameRef = useRef(false)

  const leaveRoom = useCallback(() => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('room:leave', { roomCode })
    }
    clearCurrentRoom(roomCode)
  }, [roomCode])

  useEffect(() => {
    if (!enabled) return

    const socket = connectSocket()
    const playerId = getPlayerId()
    const joinTimeoutsRef: number[] = []

    const goToGame = () => {
      navigatingToGameRef.current = true
      callbacksRef.current.onJoined(roomCode)
    }

    const handleRoomJoined = ({
      room,
      sessionToken,
    }: {
      room: { players?: Player[]; phase?: string }
      sessionToken?: string
    }) => {
      setSessionToken(roomCode, sessionToken)
      // Room active : sera réintégrée automatiquement après une reconnexion
      setCurrentRoom(roomCode)
      setPlayers(room.players || [])
      const myPlayer = room.players?.find((p) => p.id === playerId)
      setIsHost(myPlayer?.isHost ?? false)

      if (room.phase === 'playing') {
        setGameStarted(true)
        gameStartedRef.current = true
        const timeoutId = window.setTimeout(goToGame, TIMING.ROOM_JOIN_DELAY)
        joinTimeoutsRef.push(timeoutId)
      } else {
        callbacksRef.current.onJoinedSuccess?.()
      }
    }

    const handleRoomState = (state: { players?: Player[]; phase?: string }) => {
      const updatedPlayers = state.players || []
      if (Array.isArray(updatedPlayers) && updatedPlayers.length > 0) {
        setPlayers(updatedPlayers)
        const myPlayer = updatedPlayers.find((p) => p.id === playerId)
        setIsHost(myPlayer?.isHost ?? false)
      }
      if (state.phase === 'playing' && !gameStartedRef.current) {
        setGameStarted(true)
        gameStartedRef.current = true
        const timeoutId = window.setTimeout(goToGame, TIMING.ROOM_JOIN_DELAY)
        joinTimeoutsRef.push(timeoutId)
      }
    }

    const handleGameStarted = () => {
      callbacksRef.current.onGameStart?.()
      setGameStarted(true)
      gameStartedRef.current = true
      const timeoutId = window.setTimeout(goToGame, TIMING.ROOM_JOIN_DELAY)
      joinTimeoutsRef.push(timeoutId)
    }

    const handleError = ({ code, message }: { code: string; message: string }) => {
      if (code === 'GAME_ALREADY_STARTED') return
      callbacksRef.current.onError?.(code, message)
    }

    socket.on('room:joined', handleRoomJoined)
    socket.on('room:rejoined', handleRoomJoined)
    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('error', handleError)

    // La reconnexion (room:rejoin) est gérée de façon centralisée dans utils/socket.ts
    socket.emit('room:join', {
      roomCode,
      playerId,
      playerName: trimmedName,
      playerAvatar: getLocalPlayerAvatar(),
      sessionToken: getSessionToken(roomCode),
    })

    return () => {
      joinTimeoutsRef.forEach((id) => clearTimeout(id))
      socket.off('room:joined', handleRoomJoined)
      socket.off('room:rejoined', handleRoomJoined)
      socket.off('room:state', handleRoomState)
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      // En route vers /game : rester dans le salon (Game.tsx émet room:rejoin)
      if (!navigatingToGameRef.current) leaveRoom()
    }
  }, [roomCode, trimmedName, enabled, leaveRoom, callbacksRef])

  return { players, isHost, gameStarted, leaveRoom }
}

export function useRoomSocketCreate(
  params: Omit<UseRoomSocketCreateParams, 'mode'> & { mode?: 'create' }
): UseRoomSocketCreateResult {
  const {
    categories,
    playerName,
    timeLimit,
    enabled,
    skipLeaveOnUnmountRef,
    onRoomCreated,
    onError,
  } = params
  const callbacksRef = useLatestRef({ onRoomCreated, onError })
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayerName, setCurrentPlayerName] = useState('')
  const [isConnecting, setIsConnecting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const roomCodeRef = useRef<string | null>(null)

  const leaveRoom = useCallback(() => {
    const socket = getSocket()
    const code = roomCodeRef.current
    if (socket?.connected && code) {
      socket.emit('room:leave', { roomCode: code })
    }
    clearCurrentRoom(code)
  }, [])

  useEffect(() => {
    if (!enabled) return

    let timeoutId: number | null = null
    const playerId = getPlayerId()

    try {
      const socket = connectSocket()

      const handleConnect = () => {
        // Ne créer qu'un seul salon : si on a déjà un code (création précédente ou effect re-run), ne pas re-émettre
        if (roomCodeRef.current) return
        setIsConnecting(false)
        setError(null)
        socket.emit('room:create', {
          playerId,
          playerName: playerName || 'Hôte',
          playerAvatar: getLocalPlayerAvatar(),
          categories,
          defaultTimeLimit: timeLimit,
        })
      }

      const handleConnectError = () => {
        setIsConnecting(false)
        setError(
          'Impossible de se connecter au serveur. Assurez-vous que le serveur backend est démarré (port 3001).'
        )
      }

      const handleRoomCreated = ({
        roomCode: code,
        room,
        sessionToken,
      }: {
        roomCode: string
        room: { players?: Player[] }
        sessionToken?: string
      }) => {
        setSessionToken(code, sessionToken)
        setRoomCode(code)
        roomCodeRef.current = code
        // Room active : sera réintégrée automatiquement après une reconnexion
        setCurrentRoom(code)
        setPlayers(room.players || [])
        const hostPlayer = room.players?.find((p) => p.isHost)
        if (hostPlayer) {
          setCurrentPlayerName(hostPlayer.name)
        } else {
          const defaultName = playerName || 'Hôte'
          setCurrentPlayerName(defaultName)
        }
        setShareLink(`${window.location.origin}/?room=${code}`)
        setIsConnecting(false)
        setError(null)
        callbacksRef.current.onRoomCreated?.(code, room)
      }

      const handleRoomState = (state: { players?: Player[] }) => {
        const updatedPlayers = state.players || []
        if (Array.isArray(updatedPlayers) && updatedPlayers.length > 0) {
          setPlayers(updatedPlayers)
          const myPlayer = updatedPlayers.find((p) => p.id === playerId)
          if (myPlayer) setCurrentPlayerName(myPlayer.name)
        }
      }

      const handleError = ({ code, message }: { code: string; message: string }) => {
        // En mode création : ROOM_NOT_FOUND peut arriver après une reconnexion (ex: serveur redémarré)
        if (code === 'ROOM_NOT_FOUND' && roomCodeRef.current) {
          setError(
            'Le salon a été perdu (connexion interrompue). Cliquez sur Retour et recréez un salon.'
          )
          clearCurrentRoom(roomCodeRef.current)
          roomCodeRef.current = null
          setRoomCode(null)
        } else {
          setError(`Erreur: ${message}`)
        }
        setIsConnecting(false)
        callbacksRef.current.onError?.(code, message)
      }

      socket.on('connect', handleConnect)
      socket.on('connect_error', handleConnectError)
      socket.on('room:created', handleRoomCreated)
      socket.on('room:state', handleRoomState)
      socket.on('error', handleError)

      // La reconnexion (room:rejoin) est gérée de façon centralisée dans utils/socket.ts

      // Si le socket est déjà connecté (ex: navigation depuis une autre page), émettre room:create une seule fois
      if (socket.connected) {
        handleConnect()
      }

      timeoutId = window.setTimeout(() => {
        if (!roomCodeRef.current) {
          // Mise à jour fonctionnelle : ne pas écraser une erreur déjà affichée
          setError(
            (prev) =>
              prev ?? 'Le serveur ne répond pas. Vérifiez que le serveur backend est démarré.'
          )
          setIsConnecting(false)
        }
      }, TIMING.CONNECTION_TIMEOUT)

      return () => {
        if (timeoutId) clearTimeout(timeoutId)
        socket.off('connect', handleConnect)
        socket.off('connect_error', handleConnectError)
        socket.off('room:created', handleRoomCreated)
        socket.off('room:state', handleRoomState)
        socket.off('error', handleError)
        // Ne pas quitter ici : l'effet se ré-exécute quand playerName/categories/etc. changent.
        // On quitte uniquement au démontage (voir effet ci-dessous).
      }
    } catch {
      setError('Erreur lors de la connexion au serveur.')
      setIsConnecting(false)
    }
  }, [enabled, categories, playerName, timeLimit, callbacksRef])

  // Quitter le salon uniquement au démontage du composant (pas à chaque re-run de l'effet ci-dessus)
  useEffect(() => {
    return () => {
      if (!skipLeaveOnUnmountRef?.current) {
        leaveRoom()
      }
    }
  }, [skipLeaveOnUnmountRef, leaveRoom])

  return {
    roomCode,
    players,
    shareLink,
    currentPlayerName,
    isConnecting,
    error,
    leaveRoom,
  }
}
