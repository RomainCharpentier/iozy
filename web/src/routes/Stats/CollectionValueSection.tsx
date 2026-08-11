import { useQuery } from '@tanstack/react-query'
import { getCollectionValue } from '../../api/insights'
import { queryKeys } from '../../lib/queryKeys'

/** "Calcul automatique de la valeur de la collection" (§15 V2 du document de
 * conception, docs/CONCEPTION.md) - somme des prix d'achat renseignés sur
 * les possessions actuellement possédées. N'affiche JAMAIS ce total comme
 * la valeur réelle complète : la couverture (X/Y possessions avec un prix
 * renseigné) est toujours visible à côté, jamais masquée même quand elle
 * est faible - même principe que Purchase Analysis (jamais de donnée
 * inventée ni présentée comme plus certaine qu'elle ne l'est). */
export function CollectionValueSection() {
  const valueQuery = useQuery({ queryKey: queryKeys.insights.value, queryFn: getCollectionValue })

  if (!valueQuery.data || valueQuery.data.totalActiveOwnershipCount === 0) return null

  const { totalKnownValue, pricedOwnershipCount, totalActiveOwnershipCount, byType } = valueQuery.data
  const fullyCovered = pricedOwnershipCount === totalActiveOwnershipCount

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Valeur de la collection</h2>
      <div className="rounded-xl bg-surface p-3">
        <p className="font-display text-3xl font-bold text-textPrimary">{totalKnownValue.toFixed(2)} €</p>
        <p className="text-sm text-textDim">
          {fullyCovered
            ? `Sur les ${totalActiveOwnershipCount} possession${totalActiveOwnershipCount > 1 ? 's' : ''} actuelles`
            : `Prix connu sur ${pricedOwnershipCount}/${totalActiveOwnershipCount} possessions - valeur réelle probablement plus élevée`}
        </p>
        {byType.length > 1 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-sm text-textDim">
            {byType.map((type) => (
              <li key={type.entityTypeLabel}>
                {type.entityTypeLabel} : {type.knownValue.toFixed(2)} € ({type.pricedCount}/{type.totalCount})
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
