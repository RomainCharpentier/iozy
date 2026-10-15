import gameStyles from '@/pages/GamePage/Game.module.scss'
import styles from '@/pages/GamePage/question/MediaSyncOverlay.module.scss'
import { motion } from 'motion/react'

interface MediaSyncOverlayProps {
  gameStep: string
  mediaReady: boolean
  questionNumber?: number
  totalQuestions?: number
  categoryLabel?: string
  solo?: boolean
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
}: MediaSyncOverlayProps) {
  const getMessage = () => {
    if (solo) return 'Préparez-vous…'
    if (gameStep === 'loading' && !mediaReady) return 'Chargement de l’extrait…'
    if (gameStep === 'loading' && mediaReady) return 'En attente des autres joueurs…'
    if (gameStep === 'ready') return 'Tous les joueurs sont prêts !'
    if (gameStep === 'starting') return 'Préparez-vous…'
    return 'Synchronisation…'
  }

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
      </motion.div>
    </div>
  )
}
