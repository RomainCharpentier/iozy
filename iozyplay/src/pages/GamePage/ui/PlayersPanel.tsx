import gameStyles from '../Game.module.scss'
import { useState } from 'react'
import type { Player } from '@/lib/game/types'
import { getPlayerId } from '@/utils/playerId'

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
  totalQuestions = 0,
}: PlayersPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (players.length === 0) return null

  const sortedPlayers = players.sort((a, b) => b.score - a.score)
  const currentPlayerId = getPlayerId()
  const currentPlayer = players.find((p) => p.id === currentPlayerId)
  const currentPlayerScore = currentPlayer?.score || 0

  // Mettre à jour la classe du body parent
  const handleToggle = () => {
    setIsCollapsed(!isCollapsed)
    const body = document.getElementById('game-interface-body')
    if (body) {
      if (!isCollapsed) {
        body.classList.add(gameStyles.gameInterfaceBodySidebarCollapsed)
      } else {
        body.classList.remove(gameStyles.gameInterfaceBodySidebarCollapsed)
      }
    }
  }

  return (
    <>
      <div
        className={`${gameStyles.gameInterfaceSidebar} ${isCollapsed ? gameStyles.gameInterfaceSidebarCollapsed : ''}`}
        data-testid="game-players-panel"
      >
        {!isCollapsed ? (
          <>
            <div className={gameStyles.gameInterfaceSidebarHeader}>
              <div className={gameStyles.gameInterfaceSidebarTitleWrapper}>
                <span className={gameStyles.gameInterfaceSidebarTitle}>
                  {isGameEnded ? 'Classement Final' : 'Joueurs'}
                </span>
                {!isGameEnded && (
                  <span className={gameStyles.gameInterfaceSidebarCount}>({players.length})</span>
                )}
              </div>
            </div>
            <div className={gameStyles.gameInterfacePlayers}>
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
                    className={`${gameStyles.gameInterfacePlayer} ${index === 0 && isGameEnded ? `${gameStyles.gameInterfacePlayerTop} ${gameStyles.gameInterfacePlayerWinner}` : index === 0 ? gameStyles.gameInterfacePlayerTop : ''} ${isCorrect ? gameStyles.gameInterfacePlayerCorrect : ''} ${isTimeUp && isValidated && !isPlayerCorrect ? gameStyles.gameInterfacePlayerIncorrect : ''} ${isRequestingSkip ? gameStyles.gameInterfacePlayerSkipRequesting : ''}`}
                  >
                    <div className={gameStyles.gameInterfacePlayerRank}>#{index + 1}</div>
                    {index === 0 && isGameEnded && (
                      <div className={gameStyles.gameInterfaceWinnerCrown}>👑</div>
                    )}
                    <div className={gameStyles.gameInterfacePlayerAvatar}>{player.name[0]}</div>
                    <div className={gameStyles.gameInterfacePlayerInfo}>
                      <div className={gameStyles.gameInterfacePlayerName}>
                        {player.name}
                        {!isGameEnded && hasAnswered && <span className={gameStyles.answerBadge}>✓</span>}
                        {!isGameEnded && isTimeUp && isValidated && (
                          <span
                            className={`${gameStyles.validationIcon} ${isPlayerCorrect ? gameStyles.validationIconCorrect : gameStyles.validationIconIncorrect}`}
                          >
                            {isPlayerCorrect ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                      {isGameEnded && totalQuestions > 0 && (
                        <div className={gameStyles.gameInterfacePlayerFinalScore}>
                          {player.score} / {totalQuestions}
                        </div>
                      )}
                      {!isGameEnded && !isTimeUp && (
                        <div className={gameStyles.gameInterfacePlayerAnswer}>
                          {isRequestingSkip
                            ? 'Demande le skip'
                            : hasAnswered
                              ? 'En cours...'
                              : 'En attente...'}
                        </div>
                      )}
                      {!isGameEnded && isTimeUp && playerAnswer && (
                        <div
                          className={`${gameStyles.gameInterfacePlayerAnswer} ${isPlayerCorrect ? gameStyles.gameInterfacePlayerAnswerCorrect : gameStyles.gameInterfacePlayerAnswerIncorrect}`}
                        >
                          "{playerAnswer}"
                        </div>
                      )}
                    </div>
                    <div className={gameStyles.gameInterfacePlayerScore}>{player.score}</div>
                    {!isGameEnded && isTimeUp && isValidated && (
                      <div
                        className={`${gameStyles.gameInterfacePlayerBadge} ${isPlayerCorrect ? gameStyles.gameInterfacePlayerBadgeCorrect : gameStyles.gameInterfacePlayerBadgeIncorrect}`}
                      >
                        {isPlayerCorrect ? '✓' : '✗'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className={gameStyles.gameInterfaceSidebarCompact}>
            <div className={gameStyles.gameInterfaceCompactTitle}>
              {isGameEnded ? 'Score Final' : 'Score'}
            </div>
            <div className={gameStyles.gameInterfaceCompactScore}>{currentPlayerScore}</div>
            <div className={gameStyles.gameInterfaceCompactDivider}></div>
            <div className={gameStyles.gameInterfaceCompactPlayersList}>
              {sortedPlayers.map((player, index) => {
                const isValidated = validatedAnswers[player.id] !== undefined
                const isPlayerCorrect = validatedAnswers[player.id] === true
                const isRequestingSkip = skipVotes.has(player.id)
                const statusClass =
                  isTimeUp && isValidated
                    ? isPlayerCorrect
                      ? 'correct'
                      : 'incorrect'
                    : isRequestingSkip
                      ? 'skip'
                      : ''

                return (
                  <div key={player.id} className={`${gameStyles.gameInterfaceCompactPlayer} ${statusClass === 'correct' ? gameStyles.gameInterfaceCompactPlayerCorrect : statusClass === 'incorrect' ? gameStyles.gameInterfaceCompactPlayerIncorrect : statusClass === 'skip' ? gameStyles.gameInterfaceCompactPlayerSkip : ''}`}>
                    <div className={gameStyles.gameInterfaceCompactPlayerAvatar}>{player.name[0]}</div>
                    <div className={gameStyles.gameInterfaceCompactPlayerScore}>{player.score}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button
        className={`${gameStyles.gameInterfaceSidebarToggle} ${isCollapsed ? gameStyles.gameInterfaceSidebarToggleCollapsed : ''}`}
        onClick={handleToggle}
        title={isCollapsed ? 'Afficher les détails' : 'Masquer les détails'}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>
    </>
  )
}
