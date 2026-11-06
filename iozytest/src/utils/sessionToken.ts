/**
 * Jeton de session secret par salon
 * Délivré par le serveur dans room:created / room:joined, il prouve l'identité
 * du joueur lors d'un room:rejoin ou room:join (le playerId, lui, est public).
 */

const SESSION_TOKEN_PREFIX = 'blindtest-session-token:'

export function getSessionToken(roomCode: string | null | undefined): string | undefined {
  if (!roomCode) return undefined
  try {
    return localStorage.getItem(SESSION_TOKEN_PREFIX + roomCode) ?? undefined
  } catch {
    return undefined
  }
}

export function setSessionToken(roomCode: string | null | undefined, token: unknown): void {
  if (!roomCode || typeof token !== 'string' || !token) return
  try {
    localStorage.setItem(SESSION_TOKEN_PREFIX + roomCode, token)
  } catch {
    // localStorage indisponible : le joueur ne pourra pas reprendre sa session après rechargement
  }
}
