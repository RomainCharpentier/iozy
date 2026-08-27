import { useQuery } from '@tanstack/react-query'
import { getCollectionValue } from '../../api/insights'
import { queryKeys } from '../../lib/queryKeys'

/**
 * Ce que vaut la collection, au prix NEUF.
 *
 * <h2>Neuf, et non ce qu'on a payé</h2>
 * Ce total sommait les prix d'ACHAT (décision utilisateur du 2026-08-27 :
 * « la valeur de collection sera calculée par rapport à la valeur neuf »).
 * Ce que vaut une collection ne dépend pas de ce qu'elle a coûté : un tome
 * trouvé d'occasion à 2 € vaut ce que vaut ce tome. Le prix neuf vit sur
 * l'ÉDITION (`retailPriceNewPerVolume`), et se renseigne depuis l'écran
 * Éditions.
 *
 * <p>N'affiche JAMAIS ce total comme la valeur complète : la couverture
 * (X/Y tomes dont l'édition a un prix neuf) reste visible à côté, même
 * faible - jamais de donnée inventée ni présentée comme plus certaine
 * qu'elle ne l'est.
 */
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
            ? `Au prix neuf, sur les ${totalActiveOwnershipCount} possession${totalActiveOwnershipCount > 1 ? 's' : ''} actuelles`
            : `Prix neuf connu sur ${pricedOwnershipCount}/${totalActiveOwnershipCount} — le total réel est plus élevé`}
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
