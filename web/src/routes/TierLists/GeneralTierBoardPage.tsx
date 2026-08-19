import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getGeneralBoard, setGeneralRank } from '../../api/tierLists'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TierBoard } from './TierBoard'
import { TierPicker } from './TierPicker'
import { RANKS, type TierListEntryDto } from '../../types/tierList'

/** Board du classement GÉNÉRAL d'un univers - toujours l'échelle complète
 * S-F (voir DS v1.1 §45), candidats = toute œuvre réellement possédée de
 * ce type (voir TierListService.ownedEntitiesOfType côté backend). */
export function GeneralTierBoardPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeEntry, setActiveEntry] = useState<TierListEntryDto | null>(null)

  const boardQuery = useQuery({
    queryKey: queryKeys.tierLists.general(entityTypeId!),
    queryFn: () => getGeneralBoard(entityTypeId!),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const entityType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)
  const visual = getEntityTypeVisual(entityType?.code)

  const rankMutation = useMutation({
    mutationFn: (rank: (typeof RANKS)[number] | null) => setGeneralRank(activeEntry!.entityId, rank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.general(entityTypeId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(activeEntry!.entityId) })
      setActiveEntry(null)
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate('/discover')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Découvrir
      </button>

      <div className="flex items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold text-textPrimary">
          {entityType ? `Classement général · ${entityType.label}` : '…'}
        </h1>
      </div>

      {boardQuery.isError && <ErrorBanner message={boardQuery.error.message} />}
      {boardQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {boardQuery.data && (
        <TierBoard ranked={boardQuery.data.ranked} unranked={boardQuery.data.unranked} activeRanks={RANKS} onSelectEntry={setActiveEntry} />
      )}

      {activeEntry && (
        <TierPicker
          open
          onClose={() => setActiveEntry(null)}
          title={activeEntry.title}
          coverImageUrl={activeEntry.coverImageUrl}
          activeRanks={RANKS}
          currentRank={activeEntry.rank}
          onSelect={(rank) => rankMutation.mutate(rank)}
        />
      )}
    </div>
  )
}
