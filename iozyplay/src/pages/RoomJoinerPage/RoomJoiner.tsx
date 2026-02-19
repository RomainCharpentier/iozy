import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { connectSocket, getSocket } from '@/utils/socket'
import { getPlayerId } from '@/utils/playerId'
import { soundManager } from '@/utils/sounds'
import type { Player } from '@/lib/game/types'
import { TIMING } from '@/services/gameService'

interface RoomJoinerProps {
  roomCode: string
  playerName?: string
  onJoined: (roomCode: string) => void
  onBack: () => void
}

export default function RoomJoiner({
  roomCode,
  playerName: initialPlayerName,
  onJoined,
  onBack,
}: RoomJoinerProps) {
  const [playerName, setPlayerName] = useState<string>(() => {
    // Utiliser le nom depuis les settings si disponible
    if (initialPlayerName) return initialPlayerName
    try {
      const settings = JSON.parse(localStorage.getItem('blindtest-settings') || '{}')
      return settings.username || ''
    } catch {
      return ''
    }
  })
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [hasJoined, setHasJoined] = useState(!!initialPlayerName)

  const handleJoin = () => {
    if (!playerName.trim()) {
      toast.error('Veuillez entrer votre nom !', {
        icon: '👤',
      })
      return
    }
    setHasJoined(true)
  }

  useEffect(() => {
    if (!hasJoined) return

    const socket = connectSocket()
    const playerId = getPlayerId()
    const joinTimeoutsRef: number[] = []

    const handleRoomJoined = ({ room }: { room: any }) => {
      setPlayers(room.players || [])
      const myPlayer = room.players?.find((p: any) => p.id === playerId)
      setIsHost(myPlayer?.isHost || false)

      // Si la partie a déjà commencé, rediriger immédiatement
      if (room.phase === 'playing') {
        setGameStarted(true)
        const timeoutId = window.setTimeout(() => {
          onJoined(roomCode)
        }, TIMING.ROOM_JOIN_DELAY)
        joinTimeoutsRef.push(timeoutId)
      } else {
        soundManager.playSuccess()
      }
    }

    const handleRoomState = (state: any) => {
      const updatedPlayers = state.players || []
      if (Array.isArray(updatedPlayers) && updatedPlayers.length > 0) {
        setPlayers(updatedPlayers)
        const myPlayer = updatedPlayers.find((p: any) => p.id === playerId)
        setIsHost(myPlayer?.isHost || false)
      }

      if (state.phase === 'playing' && !gameStarted) {
        setGameStarted(true)
        const timeoutId = window.setTimeout(() => {
          onJoined(roomCode)
        }, TIMING.ROOM_JOIN_DELAY)
        joinTimeoutsRef.push(timeoutId)
      }
    }

    const handleGameStarted = () => {
      setGameStarted(true)
      soundManager.playStart()
      const timeoutId = window.setTimeout(() => {
        onJoined(roomCode)
      }, TIMING.ROOM_JOIN_DELAY)
      joinTimeoutsRef.push(timeoutId)
    }

    const handleError = ({ code, message }: { code: string; message: string }) => {
      // Ignorer l'erreur "GAME_ALREADY_STARTED" car le serveur envoie l'état de la partie
      if (code === 'GAME_ALREADY_STARTED') {
        return
      }
      toast.error(`Erreur: ${message}`, {
        icon: '⚠️',
      })
      // Ne pas retourner en arrière pour les erreurs non critiques
      if (code !== 'ROOM_NOT_FOUND') {
        // onBack()
      }
    }

    socket.on('room:joined', handleRoomJoined)
    socket.on('room:rejoined', handleRoomJoined)
    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('error', handleError)

    // Gérer la reconnexion
    socket.on('reconnect', () => {
      socket.emit('room:rejoin', { roomCode, playerId })
    })

    // Rejoindre le salon
    socket.emit('room:join', {
      roomCode,
      playerId,
      playerName: playerName.trim(),
    })

    return () => {
      joinTimeoutsRef.forEach((timeoutId) => clearTimeout(timeoutId))
      socket.off('room:joined', handleRoomJoined)
      socket.off('room:rejoined', handleRoomJoined)
      socket.off('room:state', handleRoomState)
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      socket.off('reconnect')

      // Quitter le salon proprement
      if (socket.connected) {
        socket.emit('room:leave', { roomCode })
      }
    }
  }, [roomCode, hasJoined, playerName, onJoined, onBack])

  if (!hasJoined) {
    return (
      <div className="room-joiner">
        <div className="room-info-card">
          <h2>👥 Rejoindre le salon : {roomCode}</h2>
          <div className="name-input-section">
            <label>
              Votre nom
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Entrez votre nom"
                maxLength={20}
                className="player-name-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && playerName.trim()) {
                    e.preventDefault()
                    handleJoin()
                  }
                }}
                aria-label="Votre nom"
                autoFocus
              />
            </label>
          </div>
          <div className="room-actions">
            <button className="back-button" onClick={onBack}>
              ← Retour
            </button>
            <button
              className="start-button"
              onClick={handleJoin}
              disabled={!playerName.trim()}
              aria-label={
                !playerName.trim() ? 'Entrez votre nom pour rejoindre' : 'Rejoindre le salon'
              }
            >
              Rejoindre →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="room-joiner">
      <div className="room-info-card">
        <h2>👥 Salon : {roomCode}</h2>

        <div className="players-list">
          <h3>Joueurs ({players.length})</h3>
          <div className="players-grid">
            {players.map((player) => (
              <div
                key={player.id}
                className={`player-badge ${player.isHost ? 'host' : ''} ${!player.connected ? 'disconnected' : ''}`}
                title={player.isHost ? 'Hôte' : 'Joueur'}
              >
                {player.name}
                {player.isHost && <span className="host-badge">👑</span>}
                {!player.connected && (
                  <span
                    className="disconnected-badge"
                    title="Déconnecté"
                    style={{ fontSize: '0.875rem' }}
                  >
                    ⚠
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {!gameStarted && (
          <div className="waiting-state">
            <p>⏳ En attente que l'hôte démarre la partie...</p>
          </div>
        )}

        {gameStarted && (
          <div className="game-starting">
            <p>La partie démarre !</p>
          </div>
        )}

        <button
          className="back-button"
          onClick={() => {
            const socket = getSocket()
            if (socket && socket.connected) {
              socket.emit('room:leave', { roomCode })
            }
            onBack()
          }}
        >
          ← Quitter le salon
        </button>
      </div>
    </div>
  )
}
