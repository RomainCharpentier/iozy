/**
 * Le classement de fin de partie et son podium.
 *
 * Rang « de compétition » : deux joueurs à égalité partagent le rang, et le
 * suivant prend le rang de sa place (9, 9, 7 → 1er, 1er, 3e). À score égal,
 * l'ordre d'affichage est stable (nom, puis identifiant) : le podium ne
 * change pas d'un rendu à l'autre.
 */
import type { Player } from '@/lib/game/types'

export interface RankedPlayer {
  player: Player
  rank: number
}

/** Une marche du podium : un rang, son score, et tous les joueurs à ce rang. */
export interface PodiumStep {
  rank: number
  score: number
  players: Player[]
}

export interface Podium {
  /** Les marches (rangs 1 à 3, au moins un point), dans l'ordre des rangs. */
  steps: PodiumStep[]
  /** Les autres joueurs, dans l'ordre du classement. */
  rest: RankedPlayer[]
  /** Les joueurs en tête (plusieurs en cas d'égalité) ; vide si personne n'a marqué. */
  leaders: Player[]
}

/** Nombre de marches du podium. */
export const PODIUM_RANKS = 3

export function rankPlayers(players: Player[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score ||
      (a.name ?? '').localeCompare(b.name ?? '', 'fr', { sensitivity: 'base' }) ||
      (a.id ?? '').localeCompare(b.id ?? '')
  )
  const ranked: RankedPlayer[] = []
  sorted.forEach((player, index) => {
    const previous = ranked[index - 1]
    const rank = previous && previous.player.score === player.score ? previous.rank : index + 1
    ranked.push({ player, rank })
  })
  return ranked
}

/**
 * Le podium : les rangs 1 à 3 montent sur les marches, égalités comprises (une
 * marche porte tous les joueurs de son rang). On n'y monte qu'avec au moins un
 * point : à zéro, on reste dans la liste.
 */
export function buildPodium(players: Player[]): Podium {
  const ranked = rankPlayers(players)
  const steps: PodiumStep[] = []
  const rest: RankedPlayer[] = []
  for (const entry of ranked) {
    if (entry.rank <= PODIUM_RANKS && entry.player.score > 0) {
      const step = steps.find((s) => s.rank === entry.rank)
      if (step) step.players.push(entry.player)
      else steps.push({ rank: entry.rank, score: entry.player.score, players: [entry.player] })
    } else {
      rest.push(entry)
    }
  }
  const leaders = steps[0]?.rank === 1 ? steps[0].players : []
  return { steps, rest, leaders }
}

/** « 1er », « 2e », « 3e »… */
export function rankLabel(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`
}
