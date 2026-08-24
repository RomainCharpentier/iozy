import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { getEntityTierSummary, setGeneralRank } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { TierBadge } from '../TierLists/TierBadge'
import { TierPicker } from '../TierLists/TierPicker'
import { RANKS, type Rank } from '../../types/tierList'

/**
 * "Mes classements" (voir DS v1.1 §52) : rang général visuellement dominant
 * (voir TierListService.customRanksFor côté backend, même commentaire) + les
 * Tier Lists personnalisées où cette œuvre est RÉELLEMENT classée. Rang
 * général géré ICI (au niveau Entity, pas Variant/tome - un classement porte
 * sur la série/l'œuvre entière, jamais un tome individuel), via le même
 * TierPicker que les boards (voir CustomTierBoardPage/GeneralTierBoardPage).
 */
export function TierSummarySection({
  entityId,
  entityTitle,
  entityTypeLabel,
  coverImageUrl,
}: {
  entityId: string
  entityTitle: string
  entityTypeLabel: string | null
  coverImageUrl: string | null
}) {
  const queryClient = useQueryClient()
  const [picking, setPicking] = useState(false)
  const summaryQuery = useQuery({
    queryKey: queryKeys.tierLists.entitySummary(entityId),
    queryFn: () => getEntityTierSummary(entityId),
  })

  const rankMutation = useMutation({
    mutationFn: (rank: Rank | null) => setGeneralRank(entityId, rank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(entityId) })
      setPicking(false)
    },
  })

  const generalRank = summaryQuery.data?.generalRank ?? null
  const customRanks = summaryQuery.data?.customRanks ?? []

  return (
    <section className="flex flex-col gap-3 border-t border-surface pt-4">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Mes classements</h2>

      <div className="rounded-2xl border border-surface2 bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Mon classement</span>
          <Link to="/tier-lists" className="min-h-11 text-xs font-semibold text-accentText">
            Toutes mes Tier Lists
          </Link>
        </div>

        {summaryQuery.isLoading ? (
          <p className="mt-3 text-sm text-textDim">Chargement...</p>
        ) : generalRank ? (
          <div className="mt-3 flex items-center gap-3">
            <TierBadge rank={generalRank} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-textPrimary">
                {entityTypeLabel ? `${entityTypeLabel} — général` : 'Classement général'}
              </span>
              <span className="text-xs text-textDim">Ton jugement, pas une note publique.</span>
            </span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="shrink-0 rounded-xl border border-fieldBorder bg-surface2 px-3.5 py-2.5 text-xs font-semibold text-textPrimary transition-colors hover:bg-rowHover"
            >
              Modifier
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="flex min-h-11 items-center rounded-xl border border-dashed border-fieldBorder bg-surface2 px-3.5 text-sm font-semibold text-textDim">
              Non classée
            </span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk transition-transform hover:-translate-y-0.5"
            >
              <Sparkles size={15} />
              Classer cette œuvre
            </button>
          </div>
        )}

        {customRanks.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-1 border-t border-surface pt-3">
            {customRanks.map((entry) => (
              <Link
                key={entry.tierListId}
                to={`/tier-lists/${entry.tierListId}`}
                className="flex items-center gap-2.5 rounded-lg py-1 text-sm text-textPrimary transition-colors hover:text-accentText"
              >
                <TierBadge rank={entry.rank} size="compact" />
                {entry.tierListName}
              </Link>
            ))}
          </div>
        )}
      </div>

      {picking && (
        <TierPicker
          open
          onClose={() => setPicking(false)}
          title={entityTitle}
          coverImageUrl={coverImageUrl}
          activeRanks={RANKS}
          currentRank={generalRank}
          onSelect={(rank) => rankMutation.mutate(rank)}
        />
      )}
    </section>
  )
}
