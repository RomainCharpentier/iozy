import gameStyles from '../Game.module.scss'
import { useEffect, useRef } from 'react'
import { soundManager } from '@/utils/sounds'
import type { GameMode, Player } from '@/lib/game/types'
import { GameService } from '@/services/gameService'
import { getPlayerId } from '@/utils/playerId'

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
  onSoundPlayed?: () => void
  shouldPlaySound?: boolean
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
  isPopup = false,
  onSoundPlayed,
  shouldPlaySound = true,
}: ScoreProps) {
  const soundPlayedRef = useRef(false)

  // Calculer le score du joueur actuel
  const currentPlayerScore =
    gameMode === 'solo' ? score : players.find((p) => p.id === getPlayerId())?.score || 0

  const percentage = GameService.calculatePercentage(currentPlayerScore, totalQuestions)

  // Jouer le son de fin de partie une seule fois au montage du composant
  useEffect(() => {
    if (shouldPlaySound && !soundPlayedRef.current) {
      soundManager.playSuccess()
      soundPlayedRef.current = true
      onSoundPlayed?.()
    }
  }, [shouldPlaySound, onSoundPlayed])

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
    <div className={gameStyles.gameInterfaceGameEnd}>
      <div className={gameStyles.gameInterfaceEndIcon}>🏆</div>
      <div className={gameStyles.gameInterfaceEndTitle}>Partie Terminée !</div>
      <div className={gameStyles.gameInterfaceEndSubtitle}>Félicitations à tous les participants</div>
      <div className={gameStyles.gameInterfaceEndStats}>
        <div className={gameStyles.gameInterfaceEndStat}>
          <div className={gameStyles.gameInterfaceEndStatLabel}>Votre Score</div>
          <div className={gameStyles.gameInterfaceEndStatValue}>
            {currentPlayerScore} / {totalQuestions}
          </div>
        </div>
        <div className={gameStyles.gameInterfaceEndStat}>
          <div className={gameStyles.gameInterfaceEndStatLabel}>Taux de Réussite</div>
          <div className={gameStyles.gameInterfaceEndStatValue}>{percentage}%</div>
        </div>
      </div>
      <div className={gameStyles.gameInterfaceEndActions}>
        {(gameMode === 'solo' || isHost) && (
          <button
            className={`${gameStyles.gameInterfaceEndBtn} ${gameStyles.gameInterfaceEndBtnPrimary}`}
            onClick={() => {
              soundManager.playStart()
              onRestart()
            }}
          >
            🔄 Rejouer
          </button>
        )}
        <button
          className={gameStyles.gameInterfaceEndBtn}
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

  return <div className={gameStyles.scoreScreen}>{scoreContent}</div>
}
