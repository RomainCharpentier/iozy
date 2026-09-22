import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { getCollectionValue, getStats } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { formaterEuros } from '@/common/lib/formats'

/**
 * Hero "Valeur estimée" de Profil (voir DS v1.1 §44 : "la valeur domine, le
 * reste suit") : montant + badge de confiance (fiable/partiel/indisponible,
 * voir §55) + un aperçu de 2 stats réelles (titres, tomes possédés - la
 * maquette en montre 3 avec "séries complètes", non repris ici : cette
 * donnée n'existe nulle part côté backend pour l'instant sans recalcul
 * complet côté client, voir docs/DESIGN_MIGRATION_V1.2.md). Cliquable vers
 * /stats, qui contient déjà le détail (CollectionValueSection). Absent
 * entièrement tant qu'aucune possession active n'existe - jamais un "0,00 €"
 * qui aurait l'air d'une vraie valeur.
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
      {/* Le MÊME nom que la section qu'il ouvre, et que le bouton de Ma
          collection : « Valeur estimée » ici, « Valeur de la collection »
          là-bas et « Statistiques » à l'arrivée faisaient trois noms pour
          une idée (UX-6). Ce que « estimée » disait - une valeur partielle -
          est déjà porté par la pastille de couverture juste en dessous. */}
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
            <span className="text-[11px] tracking-wide text-textDim uppercase">Titres</span>
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
