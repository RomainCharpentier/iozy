import { useState, useEffect } from 'react'
import { connectSocket, getSocket } from '../utils/socket'
import { soundManager } from '../utils/sounds'
import { Player } from '../types'

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
  onBack
}: RoomJoinerProps) {
  const [playerName, setPlayerName] = useState<string>(initialPlayerName || '')
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [hasJoined, setHasJoined] = useState(!!initialPlayerName)

  const handleJoin = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer votre nom !')
      return
    }
    setHasJoined(true)
  }

  useEffect(() => {
    if (!hasJoined) return
    
    const socket = connectSocket()

    socket.on('room-joined', ({ room }) => {
      setPlayers(room.players)
      setIsHost(room.host === socket.id)
      soundManager.playSuccess()
    })

    socket.on('player-joined', ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers)
    })

    socket.on('player-left', ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers)
    })

    socket.on('game-started', () => {
      setGameStarted(true)
      soundManager.playStart()
      setTimeout(() => {
        onJoined(roomCode)
      }, 1000)
    })

    socket.on('room-error', ({ message }) => {
      alert(`Erreur: ${message}`)
      onBack()
    })

    // Rejoindre le salon
    socket.emit('join-room', {
      roomCode,
      playerName: playerName.trim()
    })

    return () => {
      socket.off('room-joined')
      socket.off('player-joined')
      socket.off('player-left')
      socket.off('game-started')
      socket.off('room-error')
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && playerName.trim()) {
                    handleJoin()
                  }
                }}
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
            {players.map(player => (
              <div
                key={player.id}
                className={`player-badge ${player.isHost ? 'host' : ''}`}
              >
                {player.name}
                {player.isHost && <span className="host-badge">👑</span>}
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
            <p>🎮 La partie démarre !</p>
          </div>
        )}

        <button className="back-button" onClick={onBack}>
          ← Quitter le salon
        </button>
      </div>
    </div>
  )
}
