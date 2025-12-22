import { useEffect } from 'react'
import { soundManager } from '../../utils/sounds'
import { GameMode, Player } from '../../types'
import { GameService } from '../../services/gameService'

interface ScoreProps {
  score: number
  totalQuestions: number
  gameMode?: GameMode
  players?: Player[]
  isHost?: boolean
  onRestart: () => void
  onModifySettings?: () => void
  onQuit: () => void
  isPopup?: boolean
}

export default function Score({ 
  score, 
  totalQuestions, 
  gameMode = 'solo',
  players = [],
  isHost = true,
  onRestart, 
  onModifySettings,
  onQuit,
  isPopup = false
}: ScoreProps) {
  const percentage = GameService.calculatePercentage(score, totalQuestions)
  const scoreMessage = GameService.getScoreMessage(percentage)
  const winner = gameMode === 'online' ? GameService.getWinner(players) : null

  // Empêcher le scroll quand la popup est ouverte
  useEffect(() => {
    if (isPopup) {
      document.body.style.overflow = 'hidden'
      soundManager.playStart() // Son de fin de partie
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isPopup])

  const scoreContent = (
    <div className={`score-card ${isPopup ? 'score-card-popup' : ''}`}>
        <h2>Partie terminée !</h2>
        
        {gameMode === 'solo' ? (
          <div className="score-display">
            <div className="score-number">
              {score} / {totalQuestions}
            </div>
            <div className="score-percentage">{percentage}%</div>
            <div className="score-message">{scoreMessage}</div>
          </div>
        ) : (
          <div className="multiplayer-score-display">
            {winner ? (
              <div className="winner-announcement">
                <h3>🏆 {winner.name} a gagné ! 🏆</h3>
                <div className="winner-score">{winner.score} / {totalQuestions}</div>
              </div>
            ) : (
              <div className="winner-announcement">
                <h3>🤝 Égalité ! 🤝</h3>
              </div>
            )}
            <div className="players-scores">
              {players
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div 
                    key={player.id} 
                    className={`player-score-item ${winner && winner.id === player.id ? 'winner' : ''}`}
                  >
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{player.name}</span>
                    <span className="score">{player.score} / {totalQuestions}</span>
                    <span className="percentage">{Math.round((player.score / totalQuestions) * 100)}%</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        <div className="score-actions">
          {(gameMode === 'solo' || isHost) && (
            <>
              {onModifySettings && (
                <button 
                  className="restart-button secondary" 
                  onClick={() => {
                    soundManager.playClick()
                    onModifySettings()
                  }}
                >
                  ⚙️ Modifier les paramètres
                </button>
              )}
              <button 
                className="restart-button" 
                onClick={() => {
                  soundManager.playStart()
                  onRestart()
                }}
              >
                🔄 Rejouer
              </button>
            </>
          )}
          <button 
            className="quit-button" 
            onClick={() => {
              soundManager.playClick()
              onQuit()
            }}
          >
            Retour au menu
          </button>
        </div>
      </div>
  )

  if (isPopup) {
    return scoreContent
  }

  return (
    <div className="score-screen">
      {scoreContent}
    </div>
  )
}


