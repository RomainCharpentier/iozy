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
    <div className="game-interface-header" data-testid="game-topbar">
      <div className="game-interface-header-main">
        <div className="game-interface-progress-section">
          <div className="game-interface-progress-header">
            {isGameEnded ? (
              <>
                <span className="game-interface-question">Question {totalQuestions}</span>
                <span className="game-interface-separator">sur</span>
                <span className="game-interface-total">{totalQuestions}</span>
              </>
            ) : (
              <>
                <span className="game-interface-question">Question {currentQuestionIndex + 1}</span>
                <span className="game-interface-separator">sur</span>
                <span className="game-interface-total">{totalQuestions}</span>
              </>
            )}
          </div>
          <div className="game-interface-progress-container">
            <div className="game-interface-progress-bar">
              <div
                className="game-interface-progress-fill"
                style={{
                  width: isGameEnded
                    ? '100%'
                    : `${GameService.calculateProgress(currentQuestionIndex, totalQuestions)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="game-interface-timer-section">
          <div className="game-interface-timer-icon" style={{ fontSize: '20px' }}>
            {isGameEnded ? '🏁' : '⏱️'}
          </div>
          <div className="game-interface-timer-value">
            {isGameEnded ? 'Terminé' : formatTime(timeRemaining)}
          </div>
        </div>
        <div className="game-interface-score-section">
          <div className="game-interface-score-label">{isGameEnded ? 'Score Final' : 'Score'}</div>
          <div className="game-interface-score-value">{score}</div>
        </div>
      </div>
      <div className="game-interface-header-actions">
        <button
          className="game-interface-action-btn"
          title="Fichiers"
          aria-label="Fichiers"
          disabled
        >
          <span style={{ fontSize: '18px' }}>📁</span>
        </button>
        {onSettings && (
          <button
            className="game-interface-action-btn"
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
          className="game-interface-action-btn danger"
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
