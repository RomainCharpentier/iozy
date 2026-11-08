import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/RoomJoinerPage/RoomJoiner.module.scss'
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Crown, Hourglass, Play } from 'lucide-react'
import { useRoomSocketJoin } from '@/hooks/useRoomSocket'
import { QuestionService } from '@/services/questionService'
import { QUESTION_COUNT, TIMING } from '@/services/gameService'
import { getSocket } from '@/utils/socket'
import { soundManager } from '@/utils/sounds'
import { settingsService } from '@/services/settingsService'
import SectionHeader from '@/components/common/SectionHeader'
import PlayerList from '@/components/common/PlayerList'
import { useIozyAccount } from '@/lib/account/IozyAccount'

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
  // Avec un compte Iozy, le nom est son pseudo : il se lit, il ne se retape pas.
  const account = useIozyAccount()

  // Vrai entre le clic sur « Démarrer la partie » (invité devenu hôte) et la réponse du serveur
  const [isStarting, setIsStarting] = useState(false)

  const handleError = useCallback((code: string, message: string) => {
    toast.error(`Erreur : ${message}`)
    setIsStarting(false)
  }, [])

  const { players, isHost, settings, gameStarted, leaveRoom } = useRoomSocketJoin({
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

  // Le serveur ne répond pas : rendre le bouton au lieu de le laisser sur « Démarrage… »
  useEffect(() => {
    if (!isStarting || gameStarted) return
    const timeoutId = window.setTimeout(() => {
      toast.error('Le serveur ne répond pas. Veuillez réessayer.')
      setIsStarting(false)
    }, 5000)
    return () => clearTimeout(timeoutId)
  }, [isStarting, gameStarted])

  // Invité devenu hôte (l'hôte a quitté le salon) : il lance la partie avec les réglages du salon.
  // game:start revient à tout le salon, lui compris, et le lobby bascule alors vers /game.
  const handleStartAsHost = async () => {
    if (isStarting || !settings) return
    setIsStarting(true)
    try {
      const allQuestions = await QuestionService.getQuestionsForCategories(settings.categories)
      if (allQuestions.length === 0) {
        toast.error('Erreur : Aucune question disponible.')
        setIsStarting(false)
        return
      }
      const socket = getSocket()
      if (!socket?.connected) {
        toast.error('Erreur : Socket non connecté. Veuillez rafraîchir la page.')
        setIsStarting(false)
        return
      }
      const timeLimit = settings.defaultTimeLimit ?? TIMING.DEFAULT_TIME_LIMIT
      const pool = QuestionService.buildQuestionPool(allQuestions)
      socket.emit('game:start', {
        roomCode,
        questions: QuestionService.applyDefaultTimeLimit(pool, timeLimit),
        defaultTimeLimit: timeLimit,
        questionCount: QUESTION_COUNT.DEFAULT,
      })
    } catch (err) {
      console.error('Erreur au démarrage de la partie :', err)
      toast.error('Erreur : impossible de démarrer la partie. Réessaie.')
      setIsStarting(false)
    }
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
          subtitle={
            account
              ? 'Tu rejoins sous le pseudo de ton compte Iozy.'
              : 'Le nom que les autres joueurs verront pendant la partie.'
          }
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
              readOnly={!!account}
              autoFocus={!account}
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
      ) : isHost ? (
        <div className={styles.hostStart}>
          <p className={styles.status} role="status">
            <Crown size={16} aria-hidden="true" />
            Vous êtes maintenant l'hôte.
          </p>
          <button
            type="button"
            className={`${ds.btn} ${ds.btnPrimary}`}
            onClick={handleStartAsHost}
            disabled={!settings || isStarting}
          >
            <Play size={16} aria-hidden="true" />
            {isStarting ? 'Démarrage…' : 'Démarrer la partie'}
          </button>
        </div>
      ) : (
        <p className={styles.status} role="status">
          <Hourglass size={16} aria-hidden="true" />
          En attente que l'hôte démarre la partie…
        </p>
      )}
    </div>
  )
}
