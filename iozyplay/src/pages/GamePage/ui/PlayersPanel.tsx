import gameStyles from '@/pages/GamePage/Game.module.scss'
import type { Player } from '@/lib/game/types'
import { getPlayerAvatarLabel } from '@/utils/playerAvatar'

interface PlayersPanelProps {
  players: Player[]
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

  // Copie triée : ne pas muter le tableau reçu en props
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  // Couronne réservée à un vainqueur net : score strictement positif et strictement
  // supérieur au deuxième (pas de couronne sur une égalité ou à 0 point partout).
  const topScore = sortedPlayers[0]?.score ?? 0
  const isUniqueWinner =
    topScore > 0 && (sortedPlayers.length < 2 || sortedPlayers[1].score < topScore)

  return (
    <div className={gameStyles.gameInterfaceSidebar} data-testid="game-players-panel">
      <div className={gameStyles.gameInterfaceSidebarHeader}>
        <div className={gameStyles.gameInterfaceSidebarTitleWrapper}>
          <span className={gameStyles.gameInterfaceSidebarTitle}>
            {isGameEnded ? 'Classement Final' : 'Classement'}
          </span>
          {!isGameEnded && (
            <span className={gameStyles.gameInterfaceSidebarCount}>{players.length}</span>
          )}
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
              className={`${gameStyles.gameInterfacePlayer} ${index === 0 && isGameEnded && isUniqueWinner ? `${gameStyles.gameInterfacePlayerTop} ${gameStyles.gameInterfacePlayerWinner}` : index === 0 ? gameStyles.gameInterfacePlayerTop : ''} ${isCorrect ? gameStyles.gameInterfacePlayerCorrect : ''} ${isRevealPhase && isValidated && !isPlayerCorrect ? gameStyles.gameInterfacePlayerIncorrect : ''} ${isRequestingSkip ? gameStyles.gameInterfacePlayerSkipRequesting : ''}`}
            >
              {/* Vainqueur : la couronne prend la place du rang (pas de chevauchement du nom).
                  Réservée à un score strictement positif et strictement supérieur au suivant :
                  pas de couronne sur une égalité (y compris à 0 point). */}
              {index === 0 && isGameEnded && isUniqueWinner ? (
                <div
                  className={`${gameStyles.gameInterfacePlayerRank} ${gameStyles.gameInterfaceWinnerCrown}`}
                  title="Vainqueur"
                  aria-label="Vainqueur, 1er"
                >
                  👑
                </div>
              ) : (
                <div className={gameStyles.gameInterfacePlayerRank}>#{index + 1}</div>
              )}
              <div className={gameStyles.gameInterfacePlayerAvatar}>
                {getPlayerAvatarLabel(player)}
              </div>
              <div className={gameStyles.gameInterfacePlayerInfo}>
                <div className={gameStyles.gameInterfacePlayerName}>{player.name}</div>
                {!isGameEnded && isRevealPhase && playerAnswer && (
                  <div
                    className={`${gameStyles.gameInterfacePlayerAnswer} ${isPlayerCorrect ? gameStyles.gameInterfacePlayerAnswerCorrect : gameStyles.gameInterfacePlayerAnswerIncorrect}`}
                  >
                    "{playerAnswer}"
                  </div>
                )}
                {!isGameEnded && !isRevealPhase && isRequestingSkip && (
                  <div className={gameStyles.gameInterfacePlayerAnswer}>Veut passer</div>
                )}
                {!isGameEnded && !isRevealPhase && !isRequestingSkip && hasAnswered && (
                  <div className={gameStyles.gameInterfacePlayerAnswer}>Réponse envoyée</div>
                )}
              </div>
              {/* Un seul format de score : « X / N » en fin de partie, le nombre de points sinon */}
              <div className={gameStyles.gameInterfacePlayerScore}>
                {player.score}
                {isGameEnded && totalQuestions > 0 && (
                  <span className={gameStyles.gameInterfacePlayerScoreTotal}>
                    {' '}
                    / {totalQuestions}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
