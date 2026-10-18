import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { getCollectionValue, getStats } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { formaterEuros } from '@/common/lib/formats'

/**
 * "Valeur estimée" hero of Profil (see DS v1.1 section 44: "the value dominates, the
 * rest follows"): amount + confidence badge (reliable/partial/unavailable,
 * see section 55) + a preview of 2 real stats (works in the catalog, owned copies - the
 * mockup shows 3 with "complete series", not taken here: this
 * data exists nowhere on the backend side for now without a full
 * recomputation on the client side, see docs/DESIGN_MIGRATION_V1.2.md). Clickable to
 * /stats, which already contains the detail (CollectionValueSection). Absent
 * entirely as long as no active ownership exists - never a "0,00 €"
 * that would look like a real value.
 */
export function ProfileValueHero() {
  const navigate = useNavigate()
  const valueQuery = useQuery({ queryKey: queryKeys.insights.value, queryFn: getCollectionValue })
  const statsQuery = useQuery({ queryKey: queryKeys.insights.stats, queryFn: getStats })

  if (!valueQuery.data || valueQuery.data.totalActiveOwnershipCount === 0) return null
  const { totalKnownValue, pricedOwnershipCount, totalActiveOwnershipCount } = valueQuery.data

  const confidence: 'fiable' | 'partiel' | 'indisponible' =
    pricedOwnershipCount === 0 ? 'indisponible' : pricedOwnershipCount === totalActiveOwnershipCount ? 'fiable' : 'partiel'

  return (
    <button
      type="button"
      onClick={() => navigate('/stats', { state: { focusValeur: true } })}
      className="flex w-full flex-col items-start gap-2 rounded-[22px] bg-surface p-6 text-left shadow-token-elevated transition-transform hover:-translate-y-0.5"
    >
      {/* The SAME name as the section it opens, and as the button of My
          collection: "Valeur estimée" here, "Valeur de la collection"
          there and "Statistiques" on arrival made three names for
          one idea (UX-6). What "estimée" said - a partial value -
          is already carried by the coverage badge right below. */}
      <span className="text-[11px] font-semibold tracking-widest text-textDim uppercase">Valeur de la collection</span>
      <span className="flex flex-wrap items-baseline gap-3">
        {confidence === 'indisponible' ? (
          <span className="font-display text-2xl font-bold text-textPrimary">Pas encore de prix renseigné</span>
        ) : (
          <span className="font-display text-4xl font-bold tracking-tight text-textPrimary">{formaterEuros(totalKnownValue)}</span>
        )}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            confidence === 'fiable' ? 'bg-okTint text-ok' : 'bg-surface2 text-textDim'
          }`}
        >
          {confidence === 'fiable' ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
          {confidence === 'fiable' && 'Fiable'}
          {confidence === 'partiel' && `Partiel · ${pricedOwnershipCount}/${totalActiveOwnershipCount}`}
          {confidence === 'indisponible' && 'Indisponible'}
        </span>
      </span>
      {statsQuery.data && (
        <span className="mt-3 flex gap-7">
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-xl font-bold text-textPrimary">{statsQuery.data.totalEntities}</span>
            {/* totalEntities counts the SHARED catalog, not this account's
                titles: named as on the Stats screen, so no one reads it as
                the size of their own collection. */}
            <span className="text-[11px] tracking-wide text-textDim uppercase">Œuvres au catalogue</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-xl font-bold text-textPrimary">{statsQuery.data.totalActiveOwnerships}</span>
            <span className="text-[11px] tracking-wide text-textDim uppercase">Exemplaires possédés</span>
          </span>
        </span>
      )}
    </button>
  )
}
