import { useQuery } from '@tanstack/react-query'
import { getCollectionValue } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { formaterEuros } from '@/common/lib/formats'

/**
 * What the collection is worth, at the NEW price.
 *
 * <h2>New, and not what was paid</h2>
 * This total used to sum the PURCHASE prices (user decision of 2026-08-27:
 * "la valeur de collection sera calculée par rapport à la valeur neuf").
 * What a collection is worth does not depend on what it cost: a volume
 * found second-hand at 2 € is worth what that volume is worth. The new price lives on
 * the EDITION (`retailPriceNewPerVolume`), and is filled in from the
 * Éditions screen.
 *
 * <p>NEVER shows this total as the full value: the coverage
 * (X/Y volumes whose edition has a new price) stays visible next to it, even
 * when low - never invented data nor presented as more certain
 * than it is.
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
        <p className="font-display text-3xl font-bold text-textPrimary">{formaterEuros(totalKnownValue)}</p>
        <p className="text-sm text-textDim">
          {fullyCovered
            ? `Au prix neuf, sur les ${totalActiveOwnershipCount} possession${totalActiveOwnershipCount > 1 ? 's' : ''} actuelles`
            : `Prix neuf connu sur ${pricedOwnershipCount}/${totalActiveOwnershipCount} — le total réel est plus élevé`}
        </p>
        {byType.length > 1 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-sm text-textDim">
            {byType.map((type) => (
              <li key={type.entityTypeLabel}>
                {type.entityTypeLabel} : {formaterEuros(type.knownValue)} ({type.pricedCount}/{type.totalCount})
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
