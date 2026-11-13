import { useQuery } from '@tanstack/react-query'
import { getCollectionValue } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { formaterEuros } from '@/common/lib/formats'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Squelette } from '@/common/components/Squelette'

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

  // "Valeur de la collection" buttons land here: a failed or slow load must
  // say so, not leave the section out as if there were nothing to show.
  if (valueQuery.isError || valueQuery.isPending) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-bloc font-bold tracking-[-0.03em] text-textPrimary">Valeur de la collection</h2>
        {valueQuery.isError ? (
          <ErrorBanner message={`Valeur indisponible : ${valueQuery.error.message}`} />
        ) : (
          <Squelette lignes={2} />
        )}
      </section>
    )
  }
  if (valueQuery.data.totalActiveOwnershipCount === 0) return null

  const { totalKnownValue, pricedOwnershipCount, totalActiveOwnershipCount, byType } = valueQuery.data
  const fullyCovered = pricedOwnershipCount === totalActiveOwnershipCount

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-bloc font-bold tracking-[-0.03em] text-textPrimary">Valeur de la collection</h2>
      <div>
        <p className="font-display text-outil font-bold tracking-[-0.05em] text-textPrimary tabular-nums">{formaterEuros(totalKnownValue)}</p>
        <p className="text-secondaire mt-2 text-textDim">
          {fullyCovered
            ? `Au prix neuf, sur les ${totalActiveOwnershipCount} possession${totalActiveOwnershipCount > 1 ? 's' : ''} actuelles`
            : `Prix neuf connu sur ${pricedOwnershipCount}/${totalActiveOwnershipCount} — le total réel est plus élevé`}
        </p>
        {byType.length > 1 && (
          <ul className="text-secondaire mt-3 flex flex-col gap-0.5 text-textDim">
            {byType.map((type) => (
              <li key={type.entityTypeLabel}>
                {/* No price known for this type: "0,00 €" would read as a real
                    value of zero. */}
                {type.pricedCount === 0
                  ? `${type.entityTypeLabel} : prix neuf inconnu (${type.totalCount} possession${type.totalCount > 1 ? 's' : ''})`
                  : `${type.entityTypeLabel} : ${formaterEuros(type.knownValue)} (${type.pricedCount}/${type.totalCount})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
