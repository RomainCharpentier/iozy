import { Crown, WifiOff } from 'lucide-react'
import type { Player } from '@/lib/game/types'
import { getPlayerAvatarLabel } from '@/utils/playerAvatar'
import styles from '@/components/common/PlayerList.module.scss'

/** Les joueurs d'un salon, en lignes de liste : avatar, nom, et l'étiquette
 *  « Hôte » ou « Déconnecté » quand elle s'applique. Partagée par le salon de
 *  l'hôte et celui de l'invité, pour qu'ils ne divergent pas. */
export default function PlayerList({
  players,
  emptyLabel = "Personne pour l'instant.",
}: {
  players: Player[]
  emptyLabel?: string
}) {
  if (players.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>
  }
  return (
    <ul className={styles.list}>
      {players.map((player) => {
        const offline = player.connected === false
        return (
          <li
            key={player.id}
            className={`${styles.row} ${player.isHost ? styles.host : ''} ${offline ? styles.offline : ''}`.trim()}
          >
            <span className={styles.avatar} aria-hidden="true">
              {getPlayerAvatarLabel(player)}
            </span>
            <span className={styles.name}>{player.name}</span>
            {player.isHost && (
              <span className={styles.tag}>
                <Crown size={13} aria-hidden="true" />
                Hôte
              </span>
            )}
            {offline && (
              <span className={`${styles.tag} ${styles.tagOffline}`}>
                <WifiOff size={13} aria-hidden="true" />
                Déconnecté
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
