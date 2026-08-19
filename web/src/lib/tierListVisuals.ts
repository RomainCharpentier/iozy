import { RANKS, type GeneralBoardDto, type Rank } from '../types/tierList'

/** Couleur de fond d'un rang (voir index.css, --color-rank-*) - la LETTRE
 * porte l'information, la couleur ne fait que la renforcer (voir DS v1.1 :
 * "un rang reste compréhensible en niveaux de gris"). */
export function rankColorVar(rank: Rank): string {
  return `var(--color-rank-${rank.toLowerCase()})`
}

/** Encre du badge - toujours blanche en thème clair (fonds de rang foncés),
 * toujours sombre en thème foncé (fonds de rang éclaircis) - voir DS v1.1,
 * rankInk. Un seul jeu de classes suffit car chaque thème a sa propre
 * palette de fonds déjà calibrée pour ce contraste fixe. */
export const RANK_INK_LIGHT = '#ffffff'
export const RANK_INK_DARK = '#231e19'

/** Compteurs classé/total d'un board général - partagé entre l'écran Tier
 * Lists complet et l'aperçu compact de Découvrir (voir TierListsScreen /
 * DiscoverTierPreview), pour ne jamais faire diverger les deux calculs. */
export function boardCounts(board: GeneralBoardDto | undefined): { ranked: number; total: number } {
  if (!board) return { ranked: 0, total: 0 }
  const ranked = Object.values(board.ranked).reduce((sum, entries) => sum + (entries?.length ?? 0), 0)
  return { ranked, total: ranked + board.unranked.length }
}

/** Jusqu'à 3 rangs réels avec leurs jaquettes (S->F, seulement les rangs
 * non vides) - "quelques rangs réels, pour donner envie d'ouvrir" (voir
 * DS v1.1, écran Tier Lists dédié). Aucune requête supplémentaire : les
 * jaquettes viennent du board déjà chargé pour le compteur. */
export function boardPreviewRows(board: GeneralBoardDto | undefined, maxRows = 3, maxCoversPerRow = 4): { rank: Rank; covers: (string | null)[] }[] {
  if (!board) return []
  return RANKS.map((rank) => ({ rank, entries: board.ranked[rank] ?? [] }))
    .filter((r) => r.entries.length > 0)
    .slice(0, maxRows)
    .map((r) => ({ rank: r.rank, covers: r.entries.slice(0, maxCoversPerRow).map((e) => e.coverImageUrl) }))
}
