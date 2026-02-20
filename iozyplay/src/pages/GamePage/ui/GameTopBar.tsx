import gameStyles from '../Game.module.scss'
import { GameService } from '@/services/gameService'
import type { Question } from '@/types'
import { soundManager } from '@/utils/sounds'

interface GameTopBarProps {
  currentQuestionIndex: number
  totalQuestions: number
  currentQuestion: Question
  timeRemaining: number
  isTimeUp: boolean
  score: number
  onQuit: () => void
  onSettings?: () => void
  isGameEnded?: boolean
}

export default function GameTopBar({
  currentQuestionIndex,
  totalQuestions,
  currentQuestion,
  timeRemaining,
  isTimeUp,
  score,
  onQuit,
  onSettings,
  isGameEnded = false,
}: GameTopBarProps) {
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={gameStyles.gameInterfaceHeader} data-testid="game-topbar">
      <div className={gameStyles.gameInterfaceHeaderMain}>
        <div className={gameStyles.gameInterfaceProgressSection}>
          <div className={gameStyles.gameInterfaceProgressHeader}>
            {isGameEnded ? (
              <>
                <span className={gameStyles.gameInterfaceQuestion}>Question {totalQuestions}</span>
                <span className={gameStyles.gameInterfaceSeparator}>sur</span>
                <span className={gameStyles.gameInterfaceTotal}>{totalQuestions}</span>
              </>
            ) : (
              <>
                <span className={gameStyles.gameInterfaceQuestion}>Question {currentQuestionIndex + 1}</span>
                <span className={gameStyles.gameInterfaceSeparator}>sur</span>
                <span className={gameStyles.gameInterfaceTotal}>{totalQuestions}</span>
              </>
            )}
          </div>
          <div className={gameStyles.gameInterfaceProgressContainer}>
            <div className={gameStyles.gameInterfaceProgressBar}>
              <div
                className={gameStyles.gameInterfaceProgressFill}
                style={{
                  width: isGameEnded
                    ? '100%'
                    : `${GameService.calculateProgress(currentQuestionIndex, totalQuestions)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className={gameStyles.gameInterfaceTimerSection}>
          <div className={gameStyles.gameInterfaceTimerIcon} style={{ fontSize: '20px' }}>
            {isGameEnded ? '🏁' : '⏱️'}
          </div>
          <div className={gameStyles.gameInterfaceTimerValue}>
            {isGameEnded ? 'Terminé' : formatTime(timeRemaining)}
          </div>
        </div>
        <div className={gameStyles.gameInterfaceScoreSection}>
          <div className={gameStyles.gameInterfaceScoreLabel}>{isGameEnded ? 'Score Final' : 'Score'}</div>
          <div className={gameStyles.gameInterfaceScoreValue}>{score}</div>
        </div>
      </div>
      <div className={gameStyles.gameInterfaceHeaderActions}>
        <button
          className={gameStyles.gameInterfaceActionBtn}
          title="Fichiers"
          aria-label="Fichiers"
          disabled
        >
          <span style={{ fontSize: '18px' }}>📁</span>
        </button>
        {onSettings && (
          <button
            className={gameStyles.gameInterfaceActionBtn}
            onClick={() => {
              soundManager.playClick()
              onSettings()
            }}
            title="Paramètres"
          >
            <span style={{ fontSize: '18px' }}>⚙️</span>
          </button>
        )}
        <button
          className={`${gameStyles.gameInterfaceActionBtn} ${gameStyles.gameInterfaceActionBtnDanger}`}
          onClick={() => {
            soundManager.playClick()
            onQuit()
          }}
          data-testid="quit-button"
          title="Quitter"
          aria-label="Quitter la partie"
        >
          <span style={{ fontSize: '18px' }}>🚪</span>
        </button>
      </div>
    </div>
  )
}
