import gameStyles from '../Game.module.scss'
import styles from './MediaSyncOverlay.module.scss'

interface MediaSyncOverlayProps {
  gameStep: string
  mediaReady: boolean
}

export default function MediaSyncOverlay({ gameStep, mediaReady }: MediaSyncOverlayProps) {
  const getMessage = () => {
    if (gameStep === 'loading' && !mediaReady) return 'Chargement du média...'
    if (gameStep === 'loading' && mediaReady) return 'En attente des autres joueurs...'
    if (gameStep === 'ready') return 'Tous les joueurs sont prêts !'
    if (gameStep === 'starting') return 'Démarrage dans quelques instants...'
    return 'Synchronisation...'
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={gameStyles.loadingSpinner} style={{ margin: '0 auto var(--spacing-md)' }} />
        <p>⏳ Synchronisation...</p>
        <p className={styles.message}>{getMessage()}</p>
      </div>
    </div>
  )
}
