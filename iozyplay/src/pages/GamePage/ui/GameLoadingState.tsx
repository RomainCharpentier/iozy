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
    <div className="no-questions">
      <div className="loading-state">
        <h2>{message}</h2>
        {subMessage && <p>{subMessage}</p>}
        {showSpinner && <div className="spinner"></div>}
        {onBack && (
          <button onClick={onBack} style={{ marginTop: '1rem' }}>
            Retour au menu
          </button>
        )}
      </div>
    </div>
  )
}
