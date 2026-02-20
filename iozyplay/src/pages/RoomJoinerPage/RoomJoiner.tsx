import styles from './RoomJoiner.module.scss'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useRoomSocket, type UseRoomSocketJoinResult } from '@/hooks/useRoomSocket'
import { soundManager } from '@/utils/sounds'

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
    if (initialPlayerName) return initialPlayerName
    try {
      const settings = JSON.parse(localStorage.getItem('blindtest-settings') || '{}')
      return settings.username || ''
    } catch {
      return ''
    }
  })
  const [hasJoined, setHasJoined] = useState(!!initialPlayerName)

  const handleError = useCallback(
    (code: string, message: string) => {
      toast.error(`Erreur: ${message}`, { icon: '⚠️' })
    },
    []
  )

  const { players, isHost, gameStarted, leaveRoom } = useRoomSocket({
    mode: 'join',
    roomCode,
    playerName: playerName.trim(),
    enabled: hasJoined,
    onJoined,
    onJoinedSuccess: () => soundManager.playSuccess(),
    onGameStart: () => soundManager.playStart(),
    onError: handleError,
  }) as UseRoomSocketJoinResult

  const handleJoin = () => {
    if (!playerName.trim()) {
      toast.error('Veuillez entrer votre nom !', { icon: '👤' })
      return
    }
    setHasJoined(true)
  }

  const handleBack = useCallback(() => {
    leaveRoom()
    onBack()
  }, [leaveRoom, onBack])

  if (!hasJoined) {
    return (
      <div className={styles.roomJoiner}>
        <div className={styles.roomInfoCard}>
          <h2>👥 Rejoindre le salon : {roomCode}</h2>
          <div className={styles.nameInputSection}>
            <label>
              Votre nom
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Entrez votre nom"
                maxLength={20}
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
          <div className={styles.roomActions}>
            <button className={styles.backButton} onClick={onBack}>
              ← Retour
            </button>
            <button
              className={styles.startButton}
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
    <div className={styles.roomJoiner}>
      <div className={styles.roomInfoCard}>
        <h2>👥 Salon : {roomCode}</h2>

        <div className={styles.playersList}>
          <h3>Joueurs ({players.length})</h3>
          <div className={styles.playersGrid}>
            {players.map((player) => (
              <div
                key={player.id}
                className={`${styles.playerBadge} ${player.isHost ? styles.host : ''} ${!player.connected ? styles.disconnected : ''}`}
                title={player.isHost ? 'Hôte' : 'Joueur'}
              >
                {player.name}
                {player.isHost && <span className={styles.hostBadge}>👑</span>}
                {!player.connected && (
                  <span
                    className={styles.disconnectedBadge}
                    title="Déconnecté"
                  >
                    ⚠
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {!gameStarted && (
          <div className={styles.waitingState}>
            <p>⏳ En attente que l'hôte démarre la partie...</p>
          </div>
        )}

        {gameStarted && (
          <div className={styles.gameStarting}>
            <p>La partie démarre !</p>
          </div>
        )}

        <button className={styles.backButton} onClick={handleBack}>
          ← Quitter le salon
        </button>
      </div>
    </div>
  )
}
