import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { getEntityTierSummary, setGeneralRank } from '@/common/api/tierLists'
import { queryKeys } from '@/common/lib/queryKeys'
import { TierBadge } from '@/common/components/TierBadge'
import { TierPicker } from '@/common/components/TierPicker'
import { RANKS, type Rank } from '@/common/types/tierList'
import { Squelette } from '@/common/components/Squelette'

/**
 * "Mes classements" (see DS v1.1 section 52): general rank visually dominant
 * (see TierListService.customRanksFor on the backend side, same comment) + the
 * custom Tier Lists where this work is REALLY ranked. General
 * rank managed HERE (at the Entity level, not Variant/volume - a ranking is about
 * the whole series/work, never an individual volume), through the same
 * TierPicker as the boards (see CustomTierBoardPage/GeneralTierBoardPage).
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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[16.5px] font-semibold text-textPrimary">Mes classements</h3>
        <Link to="/tier-lists" className="flex min-h-11 items-center text-[13.5px] font-medium text-accentText">
          Toutes mes Tier Lists
        </Link>
      </div>

      {summaryQuery.isLoading ? (
        <Squelette lignes={3} />
      ) : generalRank ? (
        // The general rank is visually DOMINANT (see DS v1.1 section 52): it is
        // the judgment made on the work, not one list line among others.
        <div className="flex items-center gap-3.5 rounded-[15px] bg-gradient-to-br from-background to-surface2 p-4">
          <TierBadge rank={generalRank} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-medium text-textPrimary">
              {entityTypeLabel ? `${entityTypeLabel} — général` : 'Classement général'}
            </span>
            <span className="text-[13px] text-textDim">Ton jugement, pas une note publique.</span>
          </span>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="btn-secondaire shrink-0"
          >
            Modifier
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-[15px] bg-gradient-to-br from-background to-surface2 p-4">
          {/* `min-w`: without it, the sentence got squeezed into four lines of two
              words next to the button instead of going below it (390 px). */}
          <span className="flex min-h-11 min-w-[200px] flex-1 items-center text-sm text-textDim">
            Cette œuvre n'est classée nulle part.
          </span>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="btn-primaire"
          >
            <Sparkles size={15} />
            Classer cette œuvre
          </button>
        </div>
      )}

      {customRanks.length > 0 && (
        <div className="flex flex-col gap-1">
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
