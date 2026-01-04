import { useEffect } from 'react'
import { soundManager } from '../../../utils/sounds'
import type { GameMode, Player } from '../../../lib/game/types'
import { GameService } from '../../../services/gameService'
import { getPlayerId } from '../../../utils/playerId'

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
  // Calculer le score du joueur actuel
  const currentPlayerScore = gameMode === 'solo' 
    ? score 
    : (players.find(p => p.id === getPlayerId())?.score || 0)
  
  const percentage = GameService.calculatePercentage(currentPlayerScore, totalQuestions)

  // Jouer le son de fin de partie une seule fois au montage du composant
  useEffect(() => {
    soundManager.playSuccess() // Son de fin de partie
  }, []) // Dépendances vides : jouer le son une seule fois au montage

  // Empêcher le scroll quand la popup est ouverte
  useEffect(() => {
    if (isPopup) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isPopup])

  const scoreContent = (
    <div className="v5-enhanced-game-end">
      <div className="v5-enhanced-end-icon">🏆</div>
      <div className="v5-enhanced-end-title">Partie Terminée !</div>
      <div className="v5-enhanced-end-subtitle">Félicitations à tous les participants</div>
      <div className="v5-enhanced-end-stats">
        <div className="v5-enhanced-end-stat">
          <div className="v5-enhanced-end-stat-label">Votre Score</div>
          <div className="v5-enhanced-end-stat-value">{currentPlayerScore} / {totalQuestions}</div>
        </div>
        <div className="v5-enhanced-end-stat">
          <div className="v5-enhanced-end-stat-label">Taux de Réussite</div>
          <div className="v5-enhanced-end-stat-value">{percentage}%</div>
        </div>
      </div>
      <div className="v5-enhanced-end-actions">
        {(gameMode === 'solo' || isHost) && (
          <button 
            className="v5-enhanced-end-btn primary" 
            onClick={() => {
              soundManager.playStart()
              onRestart()
            }}
          >
            🔄 Rejouer
          </button>
        )}
        <button 
          className="v5-enhanced-end-btn" 
          onClick={() => {
            soundManager.playClick()
            onQuit()
          }}
        >
          🏠 Accueil
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


