import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { getGeneralBoard, setGeneralRank } from '../../api/tierLists'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TierBoard } from './TierBoard'
import { TierPicker } from './TierPicker'
import { useQuickRank } from './useQuickRank'
import { RANKS, type Rank, type TierListEntryDto } from '../../types/tierList'

/** Board du classement GÉNÉRAL d'un univers - toujours l'échelle complète
 * S-F (voir DS v1.1 §45), candidats = toute œuvre réellement possédée de
 * ce type (voir TierListService.ownedEntitiesOfType côté backend). */
export function GeneralTierBoardPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  const navigate = useNavigate()
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

  // "Classer mes éléments" (Découvrir/Tier Lists) demande le classement
  // rapide, pas seulement l'ouverture du board (voir DS v1.1 §50) - la file
  // ne peut démarrer qu'une fois les données arrivées, d'où ce démarrage
  // différé plutôt qu'au clic. Une seule fois par montage : sans ce garde,
  // chaque invalidation de requête relancerait la file depuis le début.
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
      // En classement rapide, enchaîner remplace la fermeture : le sélecteur
      // reste ouvert sur l'œuvre suivante de la file.
      if (quickRank.isActive) quickRank.next()
      else setActiveEntry(null)
    },
  })

  const selectedEntry = quickRank.isActive ? quickRank.current : activeEntry

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate('/tier-lists')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Tier Lists
      </button>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold text-textPrimary">
          {entityType ? `Classement général · ${entityType.label}` : '…'}
        </h1>
        {boardQuery.data && boardQuery.data.unranked.length > 0 && (
          <button
            type="button"
            onClick={() => quickRank.start(boardQuery.data.unranked)}
            className="ml-auto flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accentInk"
          >
            <Zap size={15} />
            Classer rapidement ({boardQuery.data.unranked.length})
          </button>
        )}
      </div>

      {boardQuery.isError && <ErrorBanner message={boardQuery.error.message} />}
      {boardQuery.isLoading && <p className="text-textDim">Chargement...</p>}
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
