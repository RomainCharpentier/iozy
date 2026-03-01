import gameStyles from '@/pages/GamePage/Game.module.scss'
import type { Player } from '@/lib/game/types'

interface PlayersPanelProps {
  players: Player[]
  questionAnsweredBy: string | null
  correctPlayers?: Set<string> // Joueurs qui ont répondu correctement (pour surlignage vert)
  answeredPlayers?: Set<string> // Joueurs qui ont soumis une réponse (pendant le guess)
  isRevealPhase?: boolean
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
  isRevealPhase = false,
  playerAnswers = {},
  validatedAnswers = {},
  skipVotes = new Set(),
  isGameEnded = false,
  totalQuestions = 0,
}: PlayersPanelProps) {
  if (players.length === 0) return null

  const sortedPlayers = players.sort((a, b) => b.score - a.score)

  return (
    <div className={gameStyles.gameInterfaceSidebar} data-testid="game-players-panel">
      <div className={gameStyles.gameInterfaceSidebarHeader}>
        <div className={gameStyles.gameInterfaceSidebarTitleWrapper}>
          <span className={gameStyles.gameInterfaceSidebarTitle}>
            {isGameEnded ? 'Classement Final' : 'Classement'}
          </span>
          {!isGameEnded && <span className={gameStyles.gameInterfaceSidebarCount}>{players.length}</span>}
        </div>
      </div>
      <div className={gameStyles.gameInterfacePlayers}>
        {sortedPlayers.map((player, index) => {
          const isCorrect = isRevealPhase && correctPlayers.has(player.id)
          const hasAnswered = !isRevealPhase && answeredPlayers.has(player.id)
          const playerAnswer = playerAnswers[player.id]
          const isValidated = validatedAnswers[player.id] !== undefined
          const isPlayerCorrect = validatedAnswers[player.id] === true
          const isRequestingSkip = skipVotes.has(player.id)

          return (
            <div
              key={player.id}
              className={`${gameStyles.gameInterfacePlayer} ${index === 0 && isGameEnded ? `${gameStyles.gameInterfacePlayerTop} ${gameStyles.gameInterfacePlayerWinner}` : index === 0 ? gameStyles.gameInterfacePlayerTop : ''} ${isCorrect ? gameStyles.gameInterfacePlayerCorrect : ''} ${isRevealPhase && isValidated && !isPlayerCorrect ? gameStyles.gameInterfacePlayerIncorrect : ''} ${isRequestingSkip ? gameStyles.gameInterfacePlayerSkipRequesting : ''}`}
            >
              <div className={gameStyles.gameInterfacePlayerRank}>#{index + 1}</div>
              {index === 0 && isGameEnded && (
                <div className={gameStyles.gameInterfaceWinnerCrown}>👑</div>
              )}
              <div className={gameStyles.gameInterfacePlayerAvatar}>{player.name[0]}</div>
              <div className={gameStyles.gameInterfacePlayerInfo}>
                <div className={gameStyles.gameInterfacePlayerName}>{player.name}</div>
                {!isGameEnded && isRevealPhase && playerAnswer && (
                  <div
                    className={`${gameStyles.gameInterfacePlayerAnswer} ${isPlayerCorrect ? gameStyles.gameInterfacePlayerAnswerCorrect : gameStyles.gameInterfacePlayerAnswerIncorrect}`}
                  >
                    "{playerAnswer}"
                  </div>
                )}
                {isGameEnded && totalQuestions > 0 && (
                  <div className={gameStyles.gameInterfacePlayerFinalScore}>
                    {player.score} / {totalQuestions}
                  </div>
                )}
                {!isGameEnded && !isRevealPhase && isRequestingSkip && (
                  <div className={gameStyles.gameInterfacePlayerAnswer}>Vote skip</div>
                )}
                {!isGameEnded && !isRevealPhase && !isRequestingSkip && hasAnswered && (
                  <div className={gameStyles.gameInterfacePlayerAnswer}>Réponse envoyée</div>
                )}
              </div>
              <div className={gameStyles.gameInterfacePlayerScore}>{player.score}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
