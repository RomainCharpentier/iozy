import { soundManager } from '../utils/sounds'
import { GameMode, Player } from '../types'

interface ScoreProps {
  score: number
  totalQuestions: number
  gameMode?: GameMode
  players?: Player[]
  isHost?: boolean
  onRestart: () => void
  onRestartWithNewCategories?: () => void
  onQuit: () => void
}

export default function Score({ 
  score, 
  totalQuestions, 
  gameMode = 'solo',
  players = [],
  isHost = true,
  onRestart, 
  onRestartWithNewCategories,
  onQuit 
}: ScoreProps) {
  const percentage = Math.round((score / totalQuestions) * 100)
  
  const getScoreMessage = () => {
    if (percentage === 100) return '🎉 Parfait ! 🎉'
    if (percentage >= 80) return '🌟 Excellent !'
    if (percentage >= 60) return '👍 Bien joué !'
    if (percentage >= 40) return '💪 Pas mal !'
    return '💪 Continue comme ça !'
  }

  // En mode multijoueur, déterminer le gagnant
  const getWinner = () => {
    if (gameMode !== 'multi' || players.length === 0) return null
    
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
    const maxScore = sortedPlayers[0].score
    const winners = sortedPlayers.filter(p => p.score === maxScore)
    
    return winners.length === 1 ? winners[0] : null // Égalité si plusieurs joueurs ont le même score max
  }

  const winner = getWinner()

  return (
    <div className="score-screen">
      <div className="score-card">
        <h2>Partie terminée !</h2>
        
        {gameMode === 'solo' ? (
          <div className="score-display">
            <div className="score-number">
              {score} / {totalQuestions}
            </div>
            <div className="score-percentage">{percentage}%</div>
            <div className="score-message">{getScoreMessage()}</div>
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
              {onRestartWithNewCategories && (
                <button 
                  className="restart-button secondary" 
                  onClick={() => {
                    soundManager.playStart()
                    onRestartWithNewCategories()
                  }}
                >
                  🎯 Relancer avec nouveaux thèmes
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
    </div>
  )
}


