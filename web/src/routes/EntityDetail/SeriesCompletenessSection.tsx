import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { groupVariantsByEdition, hasMixedEditions, type EditionGroup } from '../../lib/editionGroups'
import type { VariantDto } from '../../types/api'

/** "17/26 tomes · 9 manquants · ~62,10 € pour compléter (théorique)" - une
 * ligne par édition détectée parmi les tomes possédés (voir
 * groupVariantsByEdition). Réutilise le même moteur de complétude que
 * l'Analyse d'achat (GET /purchase-analysis/completeness), jamais un calcul
 * dupliqué côté client. */
function EditionCompletenessRow({ entityTitle, group }: { entityTitle: string; group: EditionGroup }) {
  const owned = group.volumeNumbers.length
  const label = group.edition || 'Édition non précisée'
  const known = group.edition !== ''

  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, group.edition, group.volumeNumbers),
    queryFn: () => getCompleteness(entityTitle, group.edition, group.volumeNumbers),
    enabled: known,
  })

  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-sm font-medium text-textPrimary">{label}</p>
      {!known && <p className="text-xs text-textDim">{owned} tome{owned > 1 ? 's' : ''}</p>}
      {known && completenessQuery.isLoading && <p className="text-xs text-textDim">Vérification...</p>}
      {known && completenessQuery.data && completenessQuery.data.totalVolumes === null && (
        <p className="text-xs text-textDim">{owned} tome{owned > 1 ? 's' : ''} · Total inconnu</p>
      )}
      {known && completenessQuery.data && completenessQuery.data.totalVolumes !== null && (
        <p className="text-xs text-textDim">
          {owned}/{completenessQuery.data.totalVolumes} tomes
          {completenessQuery.data.missingCount! > 0 && (
            <>
              {' '}
              · {completenessQuery.data.missingCount} manquant{completenessQuery.data.missingCount! > 1 ? 's' : ''}
              {completenessQuery.data.estimatedCostToComplete !== null && (
                <>
                  {' '}
                  · ~{completenessQuery.data.estimatedCostToComplete.toFixed(2)} € pour compléter
                  {completenessQuery.data.costToCompleteBasis === 'THEORETICAL_ONLY' ? ' (théorique)' : ' (marché)'}
                </>
              )}
            </>
          )}
        </p>
      )}
    </div>
  )
}

export function SeriesCompletenessSection({ entityTitle, variants }: { entityTitle: string; variants: VariantDto[] }) {
  const groups = groupVariantsByEdition(variants)
  if (groups.length === 0) return null

  const mixed = hasMixedEditions(groups)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Éditions</h2>
      {mixed && (
        <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Éditions mélangées : {groups.filter((g) => g.edition !== '').map((g) => `${g.edition} (${g.volumeNumbers.length})`).join(', ')}
          </span>
        </div>
      )}
      {groups.map((group) => (
        <EditionCompletenessRow key={group.edition || '(sans édition)'} entityTitle={entityTitle} group={group} />
      ))}
    </section>
  )
}
