import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from 'react-router-dom'
import { LienRetour } from '@/common/components/LienRetour'
import { Zap } from 'lucide-react'
import { getGeneralBoard, setGeneralRank } from '@/common/api/tierLists'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TierBoard } from '@/pages/tier-lists/TierBoard'
import { TierPicker } from '@/common/components/TierPicker'
import { useQuickRank } from '@/pages/tier-lists/useQuickRank'
import { RANKS, type Rank, type TierListEntryDto } from '@/common/types/tierList'
import { Squelette } from '@/common/components/Squelette'

/** Board of the GENERAL ranking of a universe - always the complete
 * S-F scale (see DS v1.1 section 45), candidates = every work really owned of
 * this type (see TierListService.ownedEntitiesOfType on the backend side). */
export function GeneralTierBoardPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  // Named by the screen of origin when it passes it, otherwise the natural parent.
  const queryClient = useQueryClient()
  const [activeEntry, setActiveEntry] = useState<TierListEntryDto | null>(null)
  const quickRank = useQuickRank()

  const boardQuery = useQuery({
    queryKey: queryKeys.tierLists.general(entityTypeId!),
    queryFn: () => getGeneralBoard(entityTypeId!),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const entityType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)
  const visual = getEntityTypeVisual(entityType)

  // "Classer mes éléments" (Découvrir/Tier Lists) asks for the quick
  // ranking, not only the opening of the board (see DS v1.1 section 50) - the queue
  // can only start once the data has arrived, hence this deferred
  // start rather than at the click. Only once per mount: without this guard,
  // each query invalidation would restart the queue from the beginning.
  const requestedQuickRank = (useLocation().state as { quickRank?: boolean } | null)?.quickRank === true
  const autoStarted = useRef(false)
  const unranked = boardQuery.data?.unranked
  const startQuickRank = quickRank.start
  useEffect(() => {
    if (!requestedQuickRank || autoStarted.current || !unranked || unranked.length === 0) return
    autoStarted.current = true
    startQuickRank(unranked)
  }, [requestedQuickRank, unranked, startQuickRank])

  const rankMutation = useMutation({
    mutationFn: ({ entityId, rank }: { entityId: string; rank: Rank | null }) => setGeneralRank(entityId, rank),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.general(entityTypeId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(variables.entityId) })
      // In quick ranking, chaining replaces closing: the picker
      // stays open on the next work of the queue.
      if (quickRank.isActive) quickRank.next()
      else setActiveEntry(null)
    },
  })

  const selectedEntry = quickRank.isActive ? quickRank.current : activeEntry


  return (
    <div className="flex flex-col gap-4">
      {/* The common back link: 44 px high (the manual copy here
          made 20), the destination named by whoever opened the screen
          (see lib/retour), otherwise the natural parent - received link, F5. */}
      <LienRetour parDefaut={{ to: '/tier-lists', libelle: 'Tier Lists' }} />

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-textPrimary">
          {entityType ? `Classement général · ${entityType.label}` : '…'}
        </h1>
        {boardQuery.data && boardQuery.data.unranked.length > 0 && (
          <button
            type="button"
            onClick={() => quickRank.start(boardQuery.data.unranked)}
            className="btn-primaire ml-auto shrink-0"
          >
            <Zap size={15} />
            Classer rapidement ({boardQuery.data.unranked.length})
          </button>
        )}
      </div>

      {boardQuery.isError && <ErrorBanner message={boardQuery.error.message} />}
      {boardQuery.isLoading && <Squelette lignes={3} />}
      {rankMutation.isError && <ErrorBanner message={rankMutation.error.message} />}

      {boardQuery.data && (
        <TierBoard
          ranked={boardQuery.data.ranked}
          unranked={boardQuery.data.unranked}
          activeRanks={RANKS}
          onSelectEntry={setActiveEntry}
          onDropEntry={(entry, rank) => rankMutation.mutate({ entityId: entry.entityId, rank })}
        />
      )}

      {selectedEntry && (
        <TierPicker
          open
          onClose={() => {
            quickRank.stop()
            setActiveEntry(null)
          }}
          title={selectedEntry.title}
          coverImageUrl={selectedEntry.coverImageUrl}
          activeRanks={RANKS}
          currentRank={selectedEntry.rank}
          onSelect={(rank) => rankMutation.mutate({ entityId: selectedEntry.entityId, rank })}
          progress={quickRank.progress}
          onSkip={quickRank.isActive ? quickRank.next : undefined}
        />
      )}
    </div>
  )
}
