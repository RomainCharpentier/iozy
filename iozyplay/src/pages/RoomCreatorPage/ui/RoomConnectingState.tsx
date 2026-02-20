import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './RoomConnectingState.module.scss'

interface RoomConnectingStateProps {
  isConnecting: boolean
  error: string | null
  onBack: () => void
}

export default function RoomConnectingState({
  isConnecting,
  error,
  onBack,
}: RoomConnectingStateProps) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Création du salon...</h2>
      {isConnecting && (
        <>
          <div className={styles.spinner}></div>
          <p className={ds.textSecondary}>Connexion au serveur...</p>
        </>
      )}
      {error && (
        <div className={styles.errorBlock}>
          <p className={styles.errorText}>{error}</p>
          <p className={ds.textSecondary} style={{ marginBottom: 'var(--spacing-md)' }}>
            Pour démarrer le serveur backend, exécutez : <code>npm run dev:server</code>
          </p>
          <button className={`${ds.btn} ${ds.btnSecondary}`} onClick={onBack}>
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
