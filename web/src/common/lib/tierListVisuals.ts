import { RANKS, type GeneralBoardDto, type Rank } from '@/common/types/tierList'

/** Background color of a rank (see index.css, --color-rank-*) - the LETTER
 * carries the information, the color only reinforces it (see DS v1.1:
 * "a rank stays understandable in grayscale"). */
export function rankColorVar(rank: Rank): string {
  return `var(--color-rank-${rank.toLowerCase()})`
}

/** Ink of the badge - always white in light theme (dark rank backgrounds),
 * always dark in dark theme (lightened rank backgrounds) - see DS v1.1,
 * rankInk. One single set of classes is enough because each theme has its
 * own palette of backgrounds already calibrated for this fixed contrast. */
export const RANK_INK_LIGHT = '#ffffff'
export const RANK_INK_DARK = '#231e19'

/** Ranked/total counters of a general board - shared between the full Tier
 * Lists screen and the compact preview of Discover (see TierListsScreen /
 * DiscoverTierPreview), to never make the two calculations diverge. */
export function boardCounts(board: GeneralBoardDto | undefined): { ranked: number; total: number } {
  if (!board) return { ranked: 0, total: 0 }
  const ranked = Object.values(board.ranked).reduce((sum, entries) => sum + (entries?.length ?? 0), 0)
  return { ranked, total: ranked + board.unranked.length }
}

/** Up to 3 real ranks with their covers (S->F, only the non-empty ranks) -
 * "a few real ranks, to make you want to open" (see DS v1.1, dedicated Tier
 * Lists screen). No extra request: the covers come from the board already
 * loaded for the counter. */
export function boardPreviewRows(board: GeneralBoardDto | undefined, maxRows = 3, maxCoversPerRow = 4): { rank: Rank; covers: (string | null)[] }[] {
  if (!board) return []
  return RANKS.map((rank) => ({ rank, entries: board.ranked[rank] ?? [] }))
    .filter((r) => r.entries.length > 0)
    .slice(0, maxRows)
    .map((r) => ({ rank: r.rank, covers: r.entries.slice(0, maxCoversPerRow).map((e) => e.coverImageUrl) }))
}

/** Covers of the first N ranked works (all ranks together, S->F order) -
 * for a compact "Tier Lists preview" row (see ProfilePage) where the rank
 * itself is not shown, just "X classés" + a visual preview. Different from
 * boardPreviewRows (which groups BY rank) - here we want a flat stream of
 * covers, whatever the rank. */
export function flatRankedCovers(board: GeneralBoardDto | undefined, max = 3): (string | null)[] {
  if (!board) return []
  return RANKS.flatMap((rank) => board.ranked[rank] ?? [])
    .slice(0, max)
    .map((e) => e.coverImageUrl)
}
