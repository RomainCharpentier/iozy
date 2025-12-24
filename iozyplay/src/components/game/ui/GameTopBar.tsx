import { GameService } from '../../../../services/gameService'
import { Question } from '../../../../types'
import { soundManager } from '../../../../utils/sounds'

interface GameTopBarProps {
  currentQuestionIndex: number
  totalQuestions: number
  currentQuestion: Question
  timeRemaining: number
  isTimeUp: boolean
  onQuit: () => void
}

export default function GameTopBar({
  currentQuestionIndex,
  totalQuestions,
  currentQuestion,
  timeRemaining,
  isTimeUp,
  onQuit
}: GameTopBarProps) {
  return (
    <div className="game-topbar" data-testid="game-topbar">
      <div className="topbar-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${GameService.calculateProgress(currentQuestionIndex, totalQuestions)}%` }}
          />
        </div>
      </div>
      <div className="topbar-question-counter">
        Question {currentQuestionIndex + 1} / {totalQuestions}
      </div>
      <div className="topbar-timer">
        <div className="timer-circle-container-small">
          <svg className="timer-circle-small" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle
              className="timer-circle-bg-small"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="8"
            />
            {timeRemaining > 0 && (
              <circle
                className={`timer-circle-progress-small ${timeRemaining <= 10 ? 'warning' : ''} ${isTimeUp ? 'time-up' : ''}`}
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - (timeRemaining / (currentQuestion.timeLimit || 30)))}`}
              />
            )}
          </svg>
          <div className={`timer-text-small ${timeRemaining <= 10 && timeRemaining > 0 ? 'warning' : ''} ${isTimeUp ? 'time-up' : ''}`}>
            {timeRemaining > 0 
              ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`
              : '--'
            }
          </div>
        </div>
      </div>
      <button
        className="topbar-quit-button"
        onClick={() => {
          soundManager.playClick()
          onQuit()
        }}
        data-testid="quit-button"
      >
        Quitter
      </button>
    </div>
  )
}

