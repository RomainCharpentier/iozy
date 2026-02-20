import gameStyles from '../Game.module.scss'

interface GameLoadingStateProps {
  message: string
  subMessage?: string
  showSpinner?: boolean
  onBack?: () => void
}

export default function GameLoadingState({
  message,
  subMessage,
  showSpinner = true,
  onBack,
}: GameLoadingStateProps) {
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
