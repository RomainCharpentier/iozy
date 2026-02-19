import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import { connectSocket, getSocket } from '@/utils/socket'
import { getPlayerId } from '@/utils/playerId'
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

function useRoomSocketJoin(
  params: UseRoomSocketJoinParams
): UseRoomSocketJoinResult {
  const { roomCode, playerName, enabled, onJoined, onJoinedSuccess, onGameStart, onError } = params
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const gameStartedRef = useRef(false)

  const leaveRoom = useCallback(() => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('room:leave', { roomCode })
    }
  }, [roomCode])

  useEffect(() => {
    if (!enabled) return

    const socket = connectSocket()
    const playerId = getPlayerId()
    const joinTimeoutsRef: number[] = []

    const handleRoomJoined = ({ room }: { room: { players?: Player[]; phase?: string } }) => {
      setPlayers(room.players || [])
      const myPlayer = room.players?.find((p) => p.id === playerId)
      setIsHost(myPlayer?.isHost ?? false)

      if (room.phase === 'playing') {
        setGameStarted(true)
        gameStartedRef.current = true
        const timeoutId = window.setTimeout(() => onJoined(roomCode), TIMING.ROOM_JOIN_DELAY)
        joinTimeoutsRef.push(timeoutId)
      } else {
        onJoinedSuccess?.()
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
        const timeoutId = window.setTimeout(() => onJoined(roomCode), TIMING.ROOM_JOIN_DELAY)
        joinTimeoutsRef.push(timeoutId)
      }
    }

    const handleGameStarted = () => {
      onGameStart?.()
      setGameStarted(true)
      gameStartedRef.current = true
      const timeoutId = window.setTimeout(() => onJoined(roomCode), TIMING.ROOM_JOIN_DELAY)
      joinTimeoutsRef.push(timeoutId)
    }

    const handleError = ({ code, message }: { code: string; message: string }) => {
      if (code === 'GAME_ALREADY_STARTED') return
      onError?.(code, message)
    }

    socket.on('room:joined', handleRoomJoined)
    socket.on('room:rejoined', handleRoomJoined)
    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('error', handleError)

    socket.on('reconnect', () => {
      socket.emit('room:rejoin', { roomCode, playerId })
    })

    socket.emit('room:join', {
      roomCode,
      playerId,
      playerName: playerName.trim(),
    })

    return () => {
      joinTimeoutsRef.forEach((id) => clearTimeout(id))
      socket.off('room:joined', handleRoomJoined)
      socket.off('room:rejoined', handleRoomJoined)
      socket.off('room:state', handleRoomState)
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      socket.off('reconnect')
      leaveRoom()
    }
  }, [roomCode, playerName.trim(), enabled, onJoined, onJoinedSuccess, onGameStart, onError, leaveRoom])

  return { players, isHost, gameStarted, leaveRoom }
}

function useRoomSocketCreate(
  params: UseRoomSocketCreateParams
): UseRoomSocketCreateResult {
  const { categories, playerName, timeLimit, enabled, skipLeaveOnUnmountRef, onRoomCreated, onError } = params
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
  }, [])

  useEffect(() => {
    if (!enabled) return

    let timeoutId: number | null = null
    const playerId = getPlayerId()

    try {
      const socket = connectSocket()

      const handleConnect = () => {
        setIsConnecting(false)
        setError(null)
        socket.emit('room:create', {
          playerId,
          playerName: playerName || 'Hôte',
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
      }: {
        roomCode: string
        room: { players?: Player[] }
      }) => {
        setRoomCode(code)
        roomCodeRef.current = code
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
        onRoomCreated?.(code, room)
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
        setError(`Erreur: ${message}`)
        setIsConnecting(false)
        onError?.(code, message)
      }

      socket.on('connect', handleConnect)
      socket.on('connect_error', handleConnectError)
      socket.on('room:created', handleRoomCreated)
      socket.on('room:state', handleRoomState)
      socket.on('error', handleError)

      socket.on('reconnect', () => {
        const code = roomCodeRef.current
        if (code) socket.emit('room:rejoin', { roomCode: code, playerId })
      })

      timeoutId = window.setTimeout(() => {
        if (!roomCodeRef.current && !error) {
          setError(
            'Le serveur ne répond pas. Vérifiez que le serveur backend est démarré.'
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
        socket.off('reconnect')
        if (!skipLeaveOnUnmountRef?.current) {
          leaveRoom()
        }
      }
    } catch {
      setError('Erreur lors de la connexion au serveur.')
      setIsConnecting(false)
    }
  }, [enabled, categories, playerName, timeLimit, skipLeaveOnUnmountRef, onRoomCreated, onError, leaveRoom])

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

export function useRoomSocket(
  params: UseRoomSocketJoinParams | UseRoomSocketCreateParams
): UseRoomSocketJoinResult | UseRoomSocketCreateResult {
  if (params.mode === 'join') {
    return useRoomSocketJoin(params)
  }
  return useRoomSocketCreate(params)
}
