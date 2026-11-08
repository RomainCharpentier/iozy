import type { Player } from '@/lib/game/types'

/** Joueurs prêts (média chargé) pour une question, tels que diffusés par room:state */
export interface ReadyPlayers {
  questionIndex: number
  playerIds: string[]
}

export interface ReadyStatus {
  readyCount: number
  totalPlayers: number
  waitingFor: string[] // noms des joueurs connectés pas encore prêts
}

/**
 * Qui la salle attend pendant le chargement : seuls les joueurs connectés comptent
 * (comme côté serveur). Le joueur local est compté prêt dès que son média l'est,
 * sans attendre le prochain room:state.
 */
export function getReadyStatus(
  players: Player[],
  readyPlayerIds: string[],
  selfId: string | undefined,
  selfReady: boolean
): ReadyStatus {
  const ready = new Set(readyPlayerIds)
  if (selfId && selfReady) ready.add(selfId)
  const connected = players.filter((p) => p.connected)
  const waiting = connected.filter((p) => !ready.has(p.id))
  return {
    readyCount: connected.length - waiting.length,
    totalPlayers: connected.length,
    waitingFor: waiting.map((p) => p.name),
  }
}
