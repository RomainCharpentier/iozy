import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useEffect, useRef } from 'react'
import { soundManager } from '@/utils/sounds'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo } from '@/lib/game/gameMode'
import { GameService } from '@/services/gameService'
import { getPlayerId } from '@/utils/playerId'

interface ScoreProps {
  score: number
  totalQuestions: number
  gameMode?: GameMode
  players?: Player[]
  isHost?: boolean
  onRestart: () => void
  onChangeThemes?: () => void // Ouvre la popup de paramètres (thèmes, timer, nombre de questions)
  onQuit: () => void // Ouvre la confirmation de sortie
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
  onChangeThemes,
  onQuit,
  onSoundPlayed,
  shouldPlaySound = true,
}: ScoreProps) {
  const soundPlayedRef = useRef(false)
  const solo = isSolo(gameMode)
  // Seul l'hôte (ou le joueur solo) peut relancer une partie : le serveur refuse les autres
  const canManage = solo || isHost

  // Calculer le score du joueur actuel
  const currentPlayerScore = solo ? score : players.find((p) => p.id === getPlayerId())?.score || 0

  const percentage = GameService.calculatePercentage(currentPlayerScore, totalQuestions)

  // Copie adaptative : éviter de « féliciter » un joueur qui n'a rien trouvé.
  const hasScored = currentPlayerScore > 0
  const endIcon = hasScored ? '🏆' : '🎮'
  const endTitle = hasScored ? 'Partie terminée !' : 'Partie terminée'
  const endSubtitle = hasScored
    ? 'Félicitations à tous les participants'
    : 'Personne n’a trouvé cette fois — tentez votre chance à la prochaine !'

  // Jouer le son de fin de partie une seule fois au montage du composant
  useEffect(() => {
    if (shouldPlaySound && !soundPlayedRef.current) {
      soundManager.playSuccess()
      soundPlayedRef.current = true
      onSoundPlayed?.()
    }
  }, [shouldPlaySound, onSoundPlayed])

  return (
    <div className={gameStyles.gameInterfaceGameEnd} data-testid="end-summary">
      <div className={gameStyles.gameInterfaceEndIcon} aria-hidden="true">
        {endIcon}
      </div>
      <h2 className={gameStyles.gameInterfaceEndTitle}>{endTitle}</h2>
      {!solo && <p className={gameStyles.gameInterfaceEndSubtitle}>{endSubtitle}</p>}
      <div className={gameStyles.gameInterfaceEndStats}>
        <div className={gameStyles.gameInterfaceEndStat}>
          <div className={gameStyles.gameInterfaceEndStatLabel}>Votre score</div>
          <div className={gameStyles.gameInterfaceEndStatValue}>
            {currentPlayerScore} / {totalQuestions}
          </div>
        </div>
        <div className={gameStyles.gameInterfaceEndStat}>
          <div className={gameStyles.gameInterfaceEndStatLabel}>Taux de réussite</div>
          <div className={gameStyles.gameInterfaceEndStatValue}>{percentage}%</div>
        </div>
      </div>

      {!canManage && (
        <p className={gameStyles.gameInterfaceEndWaiting} role="status">
          <span className={gameStyles.gameInterfaceEndWaitingDot} aria-hidden="true" />
          En attente de l'hôte pour une nouvelle partie…
        </p>
      )}

      <div className={gameStyles.gameInterfaceEndActions}>
        {canManage && (
          <button
            type="button"
            className={`${gameStyles.gameInterfaceEndBtn} ${gameStyles.gameInterfaceEndBtnPrimary}`}
            onClick={() => {
              soundManager.playStart()
              onRestart()
            }}
          >
            <span aria-hidden="true">🔄</span> Rejouer
          </button>
        )}
        {canManage && onChangeThemes && (
          <button
            type="button"
            className={gameStyles.gameInterfaceEndBtn}
            onClick={() => {
              soundManager.playClick()
              onChangeThemes()
            }}
          >
            <span aria-hidden="true">🎨</span> Changer les thèmes
          </button>
        )}
        <button
          type="button"
          className={`${gameStyles.gameInterfaceEndBtn} ${gameStyles.gameInterfaceEndBtnDanger}`}
          onClick={() => {
            soundManager.playClick()
            onQuit()
          }}
        >
          <span aria-hidden="true">🚪</span> {solo ? 'Quitter' : 'Quitter le salon'}
        </button>
      </div>
    </div>
  )
}
