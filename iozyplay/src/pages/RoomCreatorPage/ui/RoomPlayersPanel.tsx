import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/RoomCreatorPage/ui/RoomPlayersPanel.module.scss'
import type { Player } from '@/lib/game/types'
import SectionHeader from '@/components/common/SectionHeader'
import PlayerList from '@/components/common/PlayerList'

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
}: RoomPlayersPanelProps) {
  const connected = players.filter((p) => p.connected !== false).length

  return (
    <section className={`${ds.card} ${styles.panel}`} aria-labelledby="room-players">
      <SectionHeader
        title={<span id="room-players">Joueurs</span>}
        subtitle={
          players.length === 0
            ? 'Partage le lien pour que les autres rejoignent.'
            : `${connected} connecté${connected > 1 ? 's' : ''} sur ${players.length}.`
        }
      />

      <PlayerList players={players} />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="room-share-link">
          Lien d'invitation
        </label>
        <input
          id="room-share-link"
          type="text"
          value={shareLink}
          readOnly
          className={`${ds.input} ${styles.linkInput}`}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="room-player-name">
          Votre nom{currentPlayerName ? ` (actuellement ${currentPlayerName})` : ''}
        </label>
        <div className={styles.inputRow}>
          <input
            id="room-player-name"
            type="text"
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder={currentPlayerName || 'Entrez votre nom'}
            maxLength={20}
            className={ds.input}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && playerName.trim()) {
                e.preventDefault()
                onSetName()
              }
            }}
          />
          <button
            type="button"
            className={`${ds.btn} ${ds.btnSecondary}`}
            onClick={onSetName}
            disabled={!playerName.trim() || playerName.trim() === currentPlayerName}
          >
            {currentPlayerName ? 'Modifier' : 'Valider'}
          </button>
        </div>
      </div>
    </section>
  )
}
