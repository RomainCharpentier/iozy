import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/RoomCreatorPage/ui/RoomConnectingState.module.scss'
import { ArrowLeft, PlugZap } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'

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
  if (error) {
    return (
      <div className={styles.container}>
        <EmptyState
          icon={PlugZap}
          title="Le serveur ne répond pas"
          detail={
            <>
              {error}
              <br />
              Pour le démarrer en local : <code>npm run dev:server</code>
            </>
          }
          action={
            <button type="button" className={`${ds.btn} ${ds.btnSecondary}`} onClick={onBack}>
              <ArrowLeft size={15} />
              Jouer
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.container} role="status">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.title}>Création du salon…</p>
      {isConnecting && <p className={ds.textSecondary}>Connexion au serveur</p>}
    </div>
  )
}
