import gameStyles from '@/pages/GamePage/Game.module.scss'

interface LoadingScreenProps {
  message: string
  subMessage?: string
  showSpinner?: boolean
  onBack?: () => void
}

export default function LoadingScreen({
  message,
  subMessage,
  showSpinner = true,
  onBack,
}: LoadingScreenProps) {
  return (
    <div className={gameStyles.noQuestions}>
      <div className={gameStyles.loadingState}>
        <h2>{message}</h2>
        {subMessage && <p>{subMessage}</p>}
        {showSpinner && <div className={gameStyles.loadingSpinner}></div>}
        {onBack && (
          <button onClick={onBack} style={{ marginTop: '1rem' }}>
            Retour au menu
          </button>
        )}
      </div>
    </div>
  )
}
