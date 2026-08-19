import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Sparkles } from 'lucide-react'
import { listEntityTypes } from '../../api/entityTypes'
import { getGeneralBoard, listTierLists } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { boardCounts, boardPreviewRows } from '../../lib/tierListVisuals'
import { TierBadge } from '../TierLists/TierBadge'
import { ErrorBanner } from '../../components/ErrorBanner'
import type { TierListDto } from '../../types/tierList'

const MAX_UNIVERSE_PREVIEWS = 2
const MAX_CUSTOM_PREVIEWS = 3

/**
 * Panneau "Tier Lists" de Découvrir (voir DS v1.1 §44) - APERÇU compact,
 * pas l'écran complet (voir TierListsScreen sur /tier-lists) : au plus 2
 * univers, au plus 3 Tier Lists perso, chaque carte ouvre directement un
 * board. Une "porte d'entrée" vers Découvrir, pas une redite du hub.
 */
export function DiscoverTierPreview() {
  const navigate = useNavigate()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const entityTypes = entityTypesQuery.data ?? []

  const boardQueries = useQueries({
    queries: entityTypes.map((t) => ({
      queryKey: queryKeys.tierLists.general(t.id),
      queryFn: () => getGeneralBoard(t.id),
    })),
  })
  const listsQueries = useQueries({
    queries: entityTypes.map((t) => ({
      queryKey: queryKeys.tierLists.custom(t.id),
      queryFn: () => listTierLists(t.id),
    })),
  })

  if (entityTypesQuery.isError) return <ErrorBanner message={entityTypesQuery.error.message} />
  if (entityTypesQuery.isLoading) return <p className="text-textDim">Chargement...</p>
  const stillLoading = boardQueries.some((q) => q.isLoading) || listsQueries.some((q) => q.isLoading)
  if (stillLoading) return <p className="text-textDim">Chargement...</p>

  const universes = entityTypes
    .map((entityType, i) => ({ entityType, board: boardQueries[i].data, counts: boardCounts(boardQueries[i].data) }))
    .filter((u) => u.counts.total > 0)

  const previewedUniverses = universes.slice(0, MAX_UNIVERSE_PREVIEWS)

  const allCustomLists = entityTypes.flatMap((_, i) => listsQueries[i].data ?? ([] as TierListDto[]))
  const previewedCustom = allCustomLists.slice(0, MAX_CUSTOM_PREVIEWS)

  const totalUnranked = universes.reduce((sum, u) => sum + (u.counts.total - u.counts.ranked), 0)
  // "Classer mes éléments" ouvre le board général qui a le plus d'attente -
  // pas un flux séquentiel dédié multi-univers (non construit, voir
  // docs/DESIGN_MIGRATION_V1.2.md) : on emmène l'utilisateur là où classer
  // au clic, comme sur n'importe quel board, plutôt que d'inventer un
  // enchaînement automatique inexistant.
  const busiestUniverse = [...universes].sort((a, b) => b.counts.total - b.counts.ranked - (a.counts.total - a.counts.ranked))[0]

  if (universes.length === 0 && allCustomLists.length === 0) {
    return (
      <div className="rounded-2xl border border-surface2 bg-surface p-8 text-center">
        <p className="font-display text-base font-semibold text-textPrimary">Rien à classer pour l'instant</p>
        <p className="mt-1.5 text-sm text-textDim">Ajoute des œuvres à ta collection pour commencer à les classer.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {previewedUniverses.map(({ entityType, board, counts }) => {
          const visual = getEntityTypeVisual(entityType.code)
          const preview = boardPreviewRows(board, 3, 4)
          return (
            <button
              key={entityType.id}
              type="button"
              onClick={() => navigate(`/tier-lists/general/${entityType.id}`)}
              className="flex flex-col gap-3 rounded-2xl border border-surface2 bg-surface p-4 text-left shadow-token-sm transition-transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: visual.tint }}>
                  <visual.icon size={16} style={{ color: visual.color }} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-textPrimary">{entityType.label}</span>
                <ChevronRight size={16} className="shrink-0 text-textDim" />
              </span>
              {preview.length > 0 ? (
                <span className="flex flex-col gap-1.5">
                  {preview.map((row) => (
                    <span key={row.rank} className="flex items-center gap-1.5">
                      <TierBadge rank={row.rank} size="compact" />
                      <span className="flex gap-1">
                        {row.covers.map((cover, i) =>
                          cover ? (
                            <img key={i} src={cover} alt="" className="h-[22px] w-4 shrink-0 rounded object-cover" />
                          ) : (
                            <span key={i} className="h-[22px] w-4 shrink-0 rounded bg-surface2" />
                          ),
                        )}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-textDim">Rien de classé pour l'instant.</span>
              )}
              <span className="text-xs text-textDim">
                {counts.ranked} classé{counts.ranked > 1 ? 's' : ''} · {counts.total - counts.ranked} à classer
              </span>
            </button>
          )
        })}
      </div>

      {previewedCustom.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previewedCustom.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => navigate(`/tier-lists/${list.id}`)}
              className="flex min-w-[210px] flex-1 items-center gap-2.5 rounded-2xl border border-surface2 bg-surface px-3.5 py-2.5 text-left transition-transform hover:-translate-y-0.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-textPrimary">{list.name}</span>
              <span className="shrink-0 text-xs text-textDim">
                {list.rankedCount}/{list.itemCount}
              </span>
            </button>
          ))}
        </div>
      )}

      {totalUnranked > 0 && busiestUniverse && (
        <button
          type="button"
          onClick={() => navigate(`/tier-lists/general/${busiestUniverse.entityType.id}`)}
          className="flex w-full items-center gap-3 rounded-2xl bg-accentTint p-3.5 text-left transition-transform hover:-translate-y-0.5"
        >
          <Sparkles size={18} className="shrink-0 text-accentText" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-textPrimary">Classer mes éléments</span>
            <span className="block text-xs text-textDim">
              {totalUnranked} œuvre{totalUnranked > 1 ? 's' : ''} en attente d'un rang.
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-accentText" />
        </button>
      )}
    </div>
  )
}
