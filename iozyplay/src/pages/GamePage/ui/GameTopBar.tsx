import { GameService } from '../../../services/gameService'
import type { Question } from '../../../services/types'
import { soundManager } from '../../../utils/sounds'

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
  isGameEnded = false
}: GameTopBarProps) {
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="v5-enhanced-header" data-testid="game-topbar">
      <div className="v5-enhanced-header-main">
        <div className="v5-enhanced-progress-section">
          <div className="v5-enhanced-progress-header">
            {isGameEnded ? (
              <>
                <span className="v5-enhanced-question">Question {totalQuestions}</span>
                <span className="v5-enhanced-separator">sur</span>
                <span className="v5-enhanced-total">{totalQuestions}</span>
              </>
            ) : (
              <>
                <span className="v5-enhanced-question">Question {currentQuestionIndex + 1}</span>
                <span className="v5-enhanced-separator">sur</span>
                <span className="v5-enhanced-total">{totalQuestions}</span>
              </>
            )}
          </div>
          <div className="v5-enhanced-progress-container">
            <div className="v5-enhanced-progress-bar">
              <div
                className="v5-enhanced-progress-fill"
                style={{ width: isGameEnded ? '100%' : `${GameService.calculateProgress(currentQuestionIndex, totalQuestions)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="v5-enhanced-timer-section">
          <div className="v5-enhanced-timer-icon">{isGameEnded ? '🏁' : '⏱️'}</div>
          <div className="v5-enhanced-timer-value">{isGameEnded ? 'Terminé' : formatTime(timeRemaining)}</div>
        </div>
        <div className="v5-enhanced-score-section">
          <div className="v5-enhanced-score-label">{isGameEnded ? 'Score Final' : 'Score'}</div>
          <div className="v5-enhanced-score-value">{score}</div>
        </div>
      </div>
      <div className="v5-enhanced-header-actions">
        <button className="v5-enhanced-action-btn" title="Fichiers">📁</button>
        {onSettings && (
          <button 
            className="v5-enhanced-action-btn" 
            onClick={() => {
              soundManager.playClick()
              onSettings()
            }}
            title="Paramètres"
          >
            ⚙️
          </button>
        )}
        <button
          className="v5-enhanced-action-btn danger"
          onClick={() => {
            soundManager.playClick()
            onQuit()
          }}
          data-testid="quit-button"
          title="Quitter"
        >
          🚪
        </button>
      </div>
    </div>
  )
}

