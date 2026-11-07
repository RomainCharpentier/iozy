import gameStyles from '@/pages/GamePage/Game.module.scss'
import styles from '@/pages/GamePage/question/MediaSyncOverlay.module.scss'
import { motion } from 'motion/react'
import type { ReadyStatus } from '@/pages/GamePage/question/readyStatus'

interface MediaSyncOverlayProps {
  gameStep: string
  mediaReady: boolean
  questionNumber?: number
  totalQuestions?: number
  categoryLabel?: string
  solo?: boolean
  readyStatus?: ReadyStatus // En ligne : qui la salle attend pendant le chargement
}

/**
 * Écran de transition entre deux questions (en ligne) : annonce la question suivante
 * pendant le chargement du média et l'attente des autres joueurs.
 */
export default function MediaSyncOverlay({
  gameStep,
  mediaReady,
  questionNumber,
  totalQuestions,
  categoryLabel,
  solo = false,
  readyStatus,
}: MediaSyncOverlayProps) {
  const getMessage = () => {
    if (solo) return 'Préparez-vous…'
    if (gameStep === 'loading' && !mediaReady) return 'Chargement de l’extrait…'
    if (gameStep === 'loading' && mediaReady) {
      if (!readyStatus || readyStatus.totalPlayers === 0) return 'En attente des autres joueurs…'
      return `En attente des autres joueurs… (${readyStatus.readyCount}/${readyStatus.totalPlayers} prêts)`
    }
    if (gameStep === 'ready') return 'Tous les joueurs sont prêts !'
    if (gameStep === 'starting') return 'Préparez-vous…'
    return 'Synchronisation…'
  }

  const showWaitingFor =
    !solo &&
    gameStep === 'loading' &&
    mediaReady &&
    !!readyStatus &&
    readyStatus.waitingFor.length > 0

  return (
    <div className={styles.overlay} data-testid="question-intro">
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {questionNumber !== undefined && (
          <p className={styles.questionNumber}>
            Question {questionNumber}
            {totalQuestions ? <span className={styles.total}> sur {totalQuestions}</span> : null}
          </p>
        )}
        {categoryLabel && <p className={styles.category}>{categoryLabel}</p>}
        <div className={gameStyles.loadingSpinner} style={{ margin: 'var(--spacing-sm) auto' }} />
        <p className={styles.message} role="status">
          {getMessage()}
        </p>
        {showWaitingFor && (
          <p className={styles.waitingFor} data-testid="waiting-for">
            En attente de : {readyStatus.waitingFor.join(', ')}
          </p>
        )}
      </motion.div>
    </div>
  )
}
