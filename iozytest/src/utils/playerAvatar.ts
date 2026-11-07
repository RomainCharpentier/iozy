// Avatar des joueurs : aucun choix d'avatar n'existe encore dans l'UI,
// on envoie donc l'avatar par défaut (identique à DEFAULT_AVATAR côté serveur)
export const DEFAULT_AVATAR = '🎮'

/**
 * Avatar envoyé au serveur dans room:create / room:join
 */
export function getLocalPlayerAvatar(): string {
  return DEFAULT_AVATAR
}

/**
 * Contenu à afficher dans la pastille d'un joueur : son avatar,
 * sinon l'initiale de son nom (repli), sinon '?'
 */
export function getPlayerAvatarLabel(player: { name?: string; avatar?: string }): string {
  const avatar = player.avatar?.trim()
  if (avatar) return avatar
  const initial = Array.from(player.name?.trim() ?? '')[0]
  return initial ? initial.toUpperCase() : '?'
}
