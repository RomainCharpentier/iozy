import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/RoomJoinerPage/RoomJoiner.module.scss'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Hourglass, Play } from 'lucide-react'
import { useRoomSocketJoin } from '@/hooks/useRoomSocket'
import { soundManager } from '@/utils/sounds'
import { settingsService } from '@/services/settingsService'
import SectionHeader from '@/components/common/SectionHeader'
import PlayerList from '@/components/common/PlayerList'

interface RoomJoinerProps {
  roomCode: string
  playerName?: string
  /** Appelé au lancement de la partie, avec le nom choisi dans le lobby */
  onJoined: (roomCode: string, playerName: string) => void
  onBack: () => void
}

export default function RoomJoiner({
  roomCode,
  playerName: initialPlayerName,
  onJoined,
  onBack,
}: RoomJoinerProps) {
  const [playerName, setPlayerName] = useState<string>(
    () => initialPlayerName || settingsService.getSetting('username') || ''
  )
  const [hasJoined, setHasJoined] = useState(!!initialPlayerName)

  const handleError = useCallback((code: string, message: string) => {
    toast.error(`Erreur : ${message}`)
  }, [])

  const { players, gameStarted, leaveRoom } = useRoomSocketJoin({
    roomCode,
    playerName: playerName.trim(),
    enabled: hasJoined,
    onJoined: (code) => onJoined(code, playerName.trim()),
    onJoinedSuccess: () => soundManager.playSuccess(),
    onGameStart: () => soundManager.playStart(),
    onError: handleError,
  })

  const handleJoin = () => {
    if (!playerName.trim()) {
      toast.error('Entre ton nom pour rejoindre le salon.')
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
      <div className={styles.page}>
        <SectionHeader
          level={1}
          title={
            <>
              Rejoindre le salon <span className={styles.code}>{roomCode}</span>
            </>
          }
          subtitle="Le nom que les autres joueurs verront pendant la partie."
        />
        <form
          className={`${ds.card} ${styles.card}`}
          onSubmit={(e) => {
            e.preventDefault()
            handleJoin()
          }}
        >
          <label className={styles.field}>
            <span className={styles.label}>Votre nom</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Entrez votre nom"
              maxLength={20}
              className={ds.input}
              autoFocus
            />
          </label>
          <div className={styles.actions}>
            <button type="button" className={`${ds.btn} ${ds.btnTertiary}`} onClick={onBack}>
              <ArrowLeft size={15} />
              Jouer
            </button>
            <button
              type="submit"
              className={`${ds.btn} ${ds.btnPrimary}`}
              disabled={!playerName.trim()}
              aria-label={
                !playerName.trim() ? 'Entrez votre nom pour rejoindre' : 'Rejoindre le salon'
              }
            >
              Rejoindre
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    )
  }

  const connected = players.filter((p) => p.connected !== false).length

  return (
    <div className={styles.page}>
      <SectionHeader
        level={1}
        title={
          <>
            Salon <span className={styles.code}>{roomCode}</span>
          </>
        }
        subtitle={`${connected} joueur${connected > 1 ? 's' : ''} connecté${connected > 1 ? 's' : ''} sur ${players.length}.`}
        action={
          <button type="button" className={`${ds.btn} ${ds.btnTertiary}`} onClick={handleBack}>
            <ArrowLeft size={15} />
            Quitter le salon
          </button>
        }
      />

      <section className={`${ds.card} ${styles.card}`} aria-labelledby="joiner-players">
        <SectionHeader title={<span id="joiner-players">Joueurs</span>} />
        <PlayerList players={players} />
      </section>

      {gameStarted ? (
        <p className={`${styles.status} ${styles.statusStarting}`} role="status">
          <Play size={16} aria-hidden="true" />
          La partie démarre !
        </p>
      ) : (
        <p className={styles.status} role="status">
          <Hourglass size={16} aria-hidden="true" />
          En attente que l'hôte démarre la partie…
        </p>
      )}
    </div>
  )
}
