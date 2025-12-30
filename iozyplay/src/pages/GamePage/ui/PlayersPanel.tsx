import { useState } from 'react'
import type { Player } from '../../../lib/game/types'
import { getPlayerId } from '../../../utils/playerId'

interface PlayersPanelProps {
  players: Player[]
  questionAnsweredBy: string | null
  correctPlayers?: Set<string> // Joueurs qui ont répondu correctement (pour surlignage vert)
  answeredPlayers?: Set<string> // Joueurs qui ont soumis une réponse (pendant le guess)
  isTimeUp?: boolean // Si on est en phase reveal
  playerAnswers?: Record<string, string> // Réponses des joueurs
  validatedAnswers?: Record<string, boolean> // Validation des réponses
  skipVotes?: Set<string> // Joueurs qui ont voté skip
  isGameEnded?: boolean // Si la partie est terminée
  totalQuestions?: number // Nombre total de questions pour afficher le score final
}

export default function PlayersPanel({ 
  players, 
  questionAnsweredBy, 
  correctPlayers = new Set(), 
  answeredPlayers = new Set(), 
  isTimeUp = false,
  playerAnswers = {},
  validatedAnswers = {},
  skipVotes = new Set(),
  isGameEnded = false,
  totalQuestions = 0
}: PlayersPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (players.length === 0) return null

  const sortedPlayers = players.sort((a, b) => b.score - a.score)
  const currentPlayerId = getPlayerId()
  const currentPlayer = players.find(p => p.id === currentPlayerId)
  const currentPlayerScore = currentPlayer?.score || 0

  // Mettre à jour la classe du body parent
  const handleToggle = () => {
    setIsCollapsed(!isCollapsed)
    const body = document.getElementById('v5-enhanced-body')
    if (body) {
      if (!isCollapsed) {
        body.classList.add('sidebar-collapsed')
      } else {
        body.classList.remove('sidebar-collapsed')
      }
    }
  }

  return (
    <>
      <div className={`v5-enhanced-sidebar ${isCollapsed ? 'collapsed' : ''}`} data-testid="game-players-panel">
        {!isCollapsed ? (
          <>
            <div className="v5-enhanced-sidebar-header">
              <div className="v5-enhanced-sidebar-title-wrapper">
                <span className="v5-enhanced-sidebar-title">{isGameEnded ? 'Classement Final' : 'Joueurs'}</span>
                {!isGameEnded && <span className="v5-enhanced-sidebar-count">({players.length})</span>}
              </div>
            </div>
            <div className="v5-enhanced-players">
              {sortedPlayers.map((player, index) => {
                const isCorrect = isTimeUp && correctPlayers.has(player.id)
                const hasAnswered = !isTimeUp && answeredPlayers.has(player.id)
                const playerAnswer = playerAnswers[player.id]
                const isValidated = validatedAnswers[player.id] !== undefined
                const isPlayerCorrect = validatedAnswers[player.id] === true
                const isRequestingSkip = skipVotes.has(player.id)
                
                return (
                  <div
                    key={player.id}
                    className={`v5-enhanced-player ${index === 0 && isGameEnded ? 'top winner' : index === 0 ? 'top' : ''} ${isCorrect ? 'correct' : ''} ${isTimeUp && isValidated && !isPlayerCorrect ? 'incorrect' : ''} ${isRequestingSkip ? 'skip-requesting' : ''}`}
                  >
                    <div className="v5-enhanced-player-rank">#{index + 1}</div>
                    {index === 0 && isGameEnded && <div className="v5-enhanced-winner-crown">👑</div>}
                    <div className="v5-enhanced-player-avatar">{player.name[0]}</div>
                    <div className="v5-enhanced-player-info">
                      <div className="v5-enhanced-player-name">
                        {player.name}
                        {!isGameEnded && hasAnswered && <span className="answer-badge">✓</span>}
                        {!isGameEnded && isTimeUp && isValidated && (
                          <span className={`validation-icon ${isPlayerCorrect ? 'correct' : 'incorrect'}`}>
                            {isPlayerCorrect ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                      {isGameEnded && totalQuestions > 0 && (
                        <div className="v5-enhanced-player-final-score">{player.score} / {totalQuestions}</div>
                      )}
                      {!isGameEnded && !isTimeUp && (
                        <div className="v5-enhanced-player-answer">
                          {isRequestingSkip ? 'Demande le skip' : hasAnswered ? 'En cours...' : 'En attente...'}
                        </div>
                      )}
                      {!isGameEnded && isTimeUp && playerAnswer && (
                        <div className={`v5-enhanced-player-answer ${isPlayerCorrect ? 'correct' : 'incorrect'}`}>
                          "{playerAnswer}"
                        </div>
                      )}
                    </div>
                    <div className="v5-enhanced-player-score">{player.score}</div>
                    {!isGameEnded && isTimeUp && isValidated && (
                      <div className={`v5-enhanced-player-badge ${isPlayerCorrect ? 'correct' : 'incorrect'}`}>
                        {isPlayerCorrect ? '✓' : '✗'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="v5-enhanced-sidebar-compact">
            <div className="v5-enhanced-compact-title">{isGameEnded ? 'Score Final' : 'Score'}</div>
            <div className="v5-enhanced-compact-score">{currentPlayerScore}</div>
            <div className="v5-enhanced-compact-divider"></div>
            <div className="v5-enhanced-compact-players-list">
              {sortedPlayers.map((player, index) => {
                const isValidated = validatedAnswers[player.id] !== undefined
                const isPlayerCorrect = validatedAnswers[player.id] === true
                const isRequestingSkip = skipVotes.has(player.id)
                const statusClass = isTimeUp && isValidated 
                  ? (isPlayerCorrect ? 'correct' : 'incorrect')
                  : isRequestingSkip
                  ? 'skip'
                  : ''
                
                return (
                  <div key={player.id} className={`v5-enhanced-compact-player ${statusClass}`}>
                    <div className="v5-enhanced-compact-player-avatar">{player.name[0]}</div>
                    <div className="v5-enhanced-compact-player-score">{player.score}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      
      <button 
        className={`v5-enhanced-sidebar-toggle ${isCollapsed ? 'collapsed' : ''}`}
        onClick={handleToggle}
        title={isCollapsed ? 'Afficher les détails' : 'Masquer les détails'}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>
    </>
  )
}

