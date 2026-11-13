import { libelleBaseCourt } from '@/common/lib/basePrix'
import { formaterEuros } from '@/common/lib/formats'
import type { ToBuyLineDto } from '@/common/types/api'
import type { NearCompleteSuggestionDto } from '@/common/types/purchaseAnalysis'

/**
 * What it would cost to buy the volumes of a "COMPLETE" line, as the old
 * Suggestions screen said it (lot 223): "~18,00 € (théorique)".
 *
 * <h2>Where the figure comes from</h2>
 * The server prices a (series, edition) pair whose reference edition is
 * known (`/purchase-analysis/near-complete-suggestions`): only mangas, only
 * with a named edition. Every other line simply has no cost - never a guess.
 *
 * <h2>The same volumes as the line</h2>
 * The server prices every volume missing from the edition; the line lists
 * only those already out. The cost is brought back to the volumes of the
 * line, at the same average price per volume. When a series has several
 * editions, the one that holds the most volumes of the line is taken.
 */
export function coutPourFinir(ligne: ToBuyLineDto, suggestions: NearCompleteSuggestionDto[]): string | null {
  if (ligne.kind !== 'COMPLETE' || ligne.elements.length === 0) return null
  const numeros = new Set(ligne.elements.map((e) => e.number).filter((n): n is number => n !== null))
  let meilleure: NearCompleteSuggestionDto | null = null
  let communs = -1
  for (const suggestion of suggestions) {
    if (suggestion.entityId !== ligne.entityId || suggestion.estimatedCostToComplete === null || suggestion.missingCount <= 0) continue
    const n = suggestion.missingVolumeNumbers.filter((v) => numeros.has(v)).length
    if (n > communs) {
      meilleure = suggestion
      communs = n
    }
  }
  if (!meilleure || meilleure.estimatedCostToComplete === null) return null
  const montant = (meilleure.estimatedCostToComplete / meilleure.missingCount) * ligne.elements.length
  const base = libelleBaseCourt(meilleure.costToCompleteBasis)
  return `~${formaterEuros(Math.round(montant * 100) / 100)}${base ? ` (${base})` : ''}`
}
