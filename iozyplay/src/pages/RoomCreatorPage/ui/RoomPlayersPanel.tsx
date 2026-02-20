import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './RoomPlayersPanel.module.scss'
import type { Player } from '@/lib/game/types'

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
  copied,
}: RoomPlayersPanelProps) {
  return (
    <div className={`${ds.card} ${styles.panel}`}>
      <div className={ds.cardHeader}>
        <h2 className={ds.cardTitle}>Joueurs ({players.length})</h2>
      </div>

      <div className={styles.playersList}>
        {players.map((player) => (
          <div
            key={player.id}
            className={styles.playerBadge}
            style={{
              background: player.isHost ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
              borderColor: player.isHost ? 'var(--accent-primary)' : 'var(--border)',
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
      <div className={styles.shareSection}>
        <label className={styles.label}>Lien de partage</label>
        <div className={styles.inputRow}>
          <input
            type="text"
            value={shareLink}
            readOnly
            className={ds.input}
            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs)' }}
          />
        </div>
      </div>

      {/* Player Name Input */}
      <div className={styles.nameSection}>
        <label className={styles.label}>
          Votre nom {currentPlayerName && `(${currentPlayerName})`}
        </label>
        <div className={styles.inputRow}>
          <input
            type="text"
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder={currentPlayerName || 'Entrez votre nom'}
            maxLength={20}
            className={ds.input}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && playerName.trim()) {
                onSetName()
              }
            }}
          />
          <button
            className={`${ds.btn} ${ds.btnSecondary}`}
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
