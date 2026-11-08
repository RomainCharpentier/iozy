import { settingsService } from '@/services/settingsService'

// Avatar par défaut (identique à DEFAULT_AVATAR côté serveur)
export const DEFAULT_AVATAR = '🎮'

/**
 * Les avatars proposés dans les réglages. Des emojis simples (un seul
 * caractère affiché, sans jointure) : le serveur refuse au-delà de 16 unités.
 */
export const AVATAR_CHOICES: readonly { emoji: string; label: string }[] = [
  { emoji: '🎮', label: 'Manette' },
  { emoji: '🎧', label: 'Casque' },
  { emoji: '🎤', label: 'Micro' },
  { emoji: '🎸', label: 'Guitare' },
  { emoji: '🎬', label: 'Clap de cinéma' },
  { emoji: '📺', label: 'Télévision' },
  { emoji: '🤖', label: 'Robot' },
  { emoji: '👾', label: 'Monstre' },
  { emoji: '🐱', label: 'Chat' },
  { emoji: '🦊', label: 'Renard' },
  { emoji: '🐼', label: 'Panda' },
  { emoji: '🐉', label: 'Dragon' },
]

/** Vrai si l'avatar fait partie de ceux proposés dans les réglages */
export function isAvatarChoice(avatar: string): boolean {
  return AVATAR_CHOICES.some((choice) => choice.emoji === avatar)
}

/**
 * Avatar envoyé au serveur dans room:create / room:join : celui choisi dans
 * les réglages, sinon l'avatar par défaut (rien de choisi, ou valeur inconnue).
 */
export function getLocalPlayerAvatar(): string {
  const chosen = settingsService.getSetting('avatar')
  return typeof chosen === 'string' && isAvatarChoice(chosen) ? chosen : DEFAULT_AVATAR
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
