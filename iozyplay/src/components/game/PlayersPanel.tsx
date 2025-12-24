import { Player } from '../../types'

interface PlayersPanelProps {
  players: Player[]
  questionAnsweredBy: string | null
}

export default function PlayersPanel({ players, questionAnsweredBy }: PlayersPanelProps) {
  if (players.length === 0) return null

  return (
    <div className="game-players-panel" data-testid="game-players-panel">
      <div className="players-panel-header">
        <h3>Joueurs</h3>
      </div>
      <div className="players-panel-content">
        {players
          .sort((a, b) => b.score - a.score)
          .map((player, index) => (
            <div
              key={player.id}
              className={`player-score-item ${questionAnsweredBy === player.id ? 'answered' : ''}`}
            >
              <span className="player-rank">#{index + 1}</span>
              <div className="player-name">{player.name}</div>
              <div className="player-score-value">{player.score}</div>
            </div>
          ))}
      </div>
    </div>
  )
}




