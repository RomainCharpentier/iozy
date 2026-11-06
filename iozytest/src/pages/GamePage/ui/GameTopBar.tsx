import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import { GameService } from '@/services/gameService'
import { soundManager } from '@/utils/sounds'

interface GameTopBarProps {
  currentQuestionIndex: number
  totalQuestions: number
  timeRemaining: number
  score: number
  onQuit: () => void // Ouvre la confirmation de sortie (voir QuitGameDialog)
  isGameEnded?: boolean
  inviteLink?: string | null
  muted?: boolean
  onToggleMute?: () => void
}

interface ActionButtonProps {
  icon: string
  label: string
  description: string // aria-label et infobulle (le libellé est masqué sur petit écran)
  onClick: () => void
  danger?: boolean
  pressed?: boolean
  testId?: string
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
  danger = false,
  pressed,
  testId,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`${gameStyles.gameInterfaceActionBtn} ${danger ? gameStyles.gameInterfaceActionBtnDanger : ''}`}
      onClick={onClick}
      title={description}
      aria-label={description}
      aria-pressed={pressed}
      data-testid={testId}
    >
      <span className={gameStyles.gameInterfaceActionIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={gameStyles.gameInterfaceActionLabel}>{label}</span>
    </button>
  )
}

// En haut au centre : la position par défaut (en haut à droite) recouvrirait les boutons
// « Son » et « Quitter » tant que la souris reste dessus
const TOAST_POSITION = 'top-center' as const

const formatTime = (seconds: number) => {
  if (seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Seuils d'urgence du chrono (guess ET reveal, timeRemaining étant partagé entre les deux
// phases) : au-delà de la couleur, le conteneur pulse sous le seuil critique (voir le CSS,
// qui respecte prefers-reduced-motion).
const TIMER_WARNING_THRESHOLD = 10
const TIMER_DANGER_THRESHOLD = 5

const getTimerUrgencyClass = (timeRemaining: number) => {
  if (timeRemaining <= TIMER_DANGER_THRESHOLD) return gameStyles.gameInterfaceTimerSectionDanger
  if (timeRemaining <= TIMER_WARNING_THRESHOLD) return gameStyles.gameInterfaceTimerSectionWarning
  return ''
}

export default function GameTopBar({
  currentQuestionIndex,
  totalQuestions,
  timeRemaining,
  score,
  onQuit,
  isGameEnded = false,
  inviteLink,
  muted = false,
  onToggleMute,
}: GameTopBarProps) {
  // Petit « +N » qui s'envole au-dessus du score à chaque gain de points. On compare au
  // score précédent plutôt que d'écouter un évènement dédié : ça marche quel que soit le
  // mode (solo/en ligne) sans dépendre du flux d'évènements socket.
  const previousScoreRef = useRef(score)
  const [scorePop, setScorePop] = useState<{ id: number; value: number } | null>(null)
  const scorePopIdRef = useRef(0)

  useEffect(() => {
    const delta = score - previousScoreRef.current
    previousScoreRef.current = score
    if (delta > 0) {
      scorePopIdRef.current += 1
      setScorePop({ id: scorePopIdRef.current, value: delta })
    }
  }, [score])

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return
    soundManager.playClick()
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Presse-papiers indisponible')
      }
      await navigator.clipboard.writeText(inviteLink)
      toast.success('Lien du salon copié', { position: TOAST_POSITION })
    } catch (err) {
      console.error('Erreur lors de la copie du lien de salon :', err)
      // Le lien reste accessible : affiché en clair pour une copie manuelle
      toast.error('Impossible de copier le lien du salon', {
        description: inviteLink,
        duration: 15000,
        position: TOAST_POSITION,
      })
    }
  }

  const actions = (
    <div className={gameStyles.gameInterfaceHeaderActions}>
      {inviteLink && (
        <ActionButton
          icon="🔗"
          label="Inviter"
          description="Copier le lien du salon pour inviter des joueurs"
          onClick={handleCopyInviteLink}
          testId="invite-button"
        />
      )}
      {!isGameEnded && onToggleMute && (
        <ActionButton
          icon={muted ? '🔇' : '🔊'}
          label="Son"
          description={muted ? 'Rétablir le son' : 'Couper le son'}
          pressed={muted}
          onClick={onToggleMute}
          testId="mute-button"
        />
      )}
      <ActionButton
        icon="🚪"
        label="Quitter"
        description={isGameEnded ? 'Quitter le salon' : 'Quitter la partie'}
        onClick={() => {
          soundManager.playClick()
          onQuit()
        }}
        danger
        testId="quit-button"
      />
    </div>
  )

  // Écran de fin : plus de chrono ni de score (affichés sur l'écran de fin), seulement les actions
  if (isGameEnded) {
    return (
      <div className={gameStyles.gameInterfaceHeader} data-testid="game-topbar">
        <div className={gameStyles.gameInterfaceHeaderMain}>
          <div className={gameStyles.gameInterfaceEndHeading}>
            <span aria-hidden="true">🏁</span>
            <span className={gameStyles.gameInterfaceQuestion}>Partie terminée</span>
            <span className={gameStyles.gameInterfaceTotal}>
              {totalQuestions} question{totalQuestions > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {actions}
      </div>
    )
  }

  return (
    <div className={gameStyles.gameInterfaceHeader} data-testid="game-topbar">
      <div className={gameStyles.gameInterfaceHeaderMain}>
        <div className={gameStyles.gameInterfaceProgressSection}>
          <div className={gameStyles.gameInterfaceProgressHeader}>
            <span className={gameStyles.gameInterfaceQuestion}>
              Question {currentQuestionIndex + 1}
            </span>
            <span className={gameStyles.gameInterfaceSeparator}>sur</span>
            <span className={gameStyles.gameInterfaceTotal}>{totalQuestions}</span>
          </div>
          <div className={gameStyles.gameInterfaceProgressContainer}>
            <div className={gameStyles.gameInterfaceProgressBar}>
              <div
                className={gameStyles.gameInterfaceProgressFill}
                style={{
                  width: `${GameService.calculateProgress(currentQuestionIndex, totalQuestions)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className={gameStyles.gameInterfaceMeta}>
          <div
            className={`${gameStyles.gameInterfaceTimerSection} ${getTimerUrgencyClass(timeRemaining)}`}
          >
            <div className={gameStyles.gameInterfaceTimerIcon} aria-hidden="true">
              ⏱️
            </div>
            <div className={gameStyles.gameInterfaceTimerValue}>{formatTime(timeRemaining)}</div>
          </div>
          <div className={gameStyles.gameInterfaceScoreSection}>
            <div className={gameStyles.gameInterfaceScoreLabel}>Score</div>
            <div className={gameStyles.gameInterfaceScoreValue}>{score}</div>
            <AnimatePresence>
              {scorePop && (
                <motion.div
                  key={scorePop.id}
                  className={gameStyles.gameInterfaceScorePop}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: -14 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  onAnimationComplete={() => setScorePop(null)}
                  aria-hidden="true"
                >
                  +{scorePop.value}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {actions}
    </div>
  )
}
