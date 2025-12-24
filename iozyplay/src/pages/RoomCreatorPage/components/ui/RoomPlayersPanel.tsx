import { Category } from '../../../../../types'
import { CATEGORIES } from '../../../../../constants/categories'

interface Player {
  id: string
  name: string
  isHost: boolean
}

interface RoomPlayersPanelProps {
  players: Player[]
  shareLink: string
  playerName: string
  currentPlayerName: string | null
  onPlayerNameChange: (name: string) => void
  onSetName: () => void
  onCopyLink: () => void
  copied: boolean
}

export default function RoomPlayersPanel({
  players,
  shareLink,
  playerName,
  currentPlayerName,
  onPlayerNameChange,
  onSetName,
  onCopyLink,
  copied
}: RoomPlayersPanelProps) {
  return (
    <div className="card" style={{ maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
      <div className="card-header">
        <h2 className="card-title">Joueurs ({players.length})</h2>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {players.map(player => (
          <div
            key={player.id}
            className="badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-sm)',
              background: player.isHost ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
              borderColor: player.isHost ? 'var(--accent-primary)' : 'var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              {player.isHost && <span>👑</span>}
              <span>{player.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Share Link Section */}
      <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          Lien de partage
        </label>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <input
            type="text"
            value={shareLink}
            readOnly
            className="input"
            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs)' }}
          />
        </div>
      </div>

      {/* Player Name Input */}
      <div style={{ marginTop: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          Votre nom {currentPlayerName && `(${currentPlayerName})`}
        </label>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <input
            type="text"
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder={currentPlayerName || "Entrez votre nom"}
            maxLength={20}
            className="input"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && playerName.trim()) {
                onSetName()
              }
            }}
          />
          <button
            className="btn btn-secondary"
            onClick={onSetName}
            disabled={!playerName.trim() || playerName.trim() === currentPlayerName}
            style={{ whiteSpace: 'nowrap' }}
          >
            {currentPlayerName ? 'Modifier' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}

