import { settingsService } from '@/services/settingsService'

/**
 * Premier nom non vide parmi les candidats (par ordre de priorité), sinon undefined.
 * Sert aux replis `room:join` de l'écran de jeu : on n'envoie jamais de nom par défaut
 * (« Joueur »), le serveur garde alors le nom connu du joueur.
 */
export function pickPlayerName(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : ''
    if (trimmed) return trimmed
  }
  return undefined
}

/**
 * Nom d'utilisateur enregistré dans les réglages (page /username), ou undefined
 */
export function getSavedUsername(): string | undefined {
  return pickPlayerName(settingsService.getSettings().username)
}
