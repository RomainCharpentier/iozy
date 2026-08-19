import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { listEntityTypes } from '../../api/entityTypes'
import { getGeneralBoard, listTierLists } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { boardCounts, flatRankedCovers } from '../../lib/tierListVisuals'
import type { TierListDto } from '../../types/tierList'

/**
 * "Mes Tier Lists" sur Profil (voir DS v1.1 §44 écran Profil) : une rangée
 * par univers réellement classé (jaquettes des œuvres classées + compteur)
 * + une rangée par Tier List perso (compteur d'éléments, sans jaquette -
 * même réduction déjà appliquée sur TierListsScreen : éviter une requête de
 * détail par liste juste pour 3 miniatures). "Tout voir" -> `/tier-lists`.
 * Absente entièrement si rien n'est classé nulle part ET aucune Tier List
 * perso n'existe - jamais une carte vide.
 */
export function ProfileTierListsSection() {
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

  if (!entityTypesQuery.isSuccess) return null
  if (boardQueries.some((q) => q.isLoading) || listsQueries.some((q) => q.isLoading)) return null

  const universeRows = entityTypes
    .map((entityType, i) => ({ entityType, counts: boardCounts(boardQueries[i].data), covers: flatRankedCovers(boardQueries[i].data, 3) }))
    .filter((u) => u.counts.ranked > 0)

  const customLists = entityTypes.flatMap((_, i) => listsQueries[i].data ?? ([] as TierListDto[]))

  if (universeRows.length === 0 && customLists.length === 0) return null

  return (
    <div className="mt-3 rounded-2xl border border-surface2 bg-surface p-4 shadow-token-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-textPrimary">Mes Tier Lists</h2>
        <Link to="/tier-lists" className="min-h-9 text-xs font-semibold text-accentText">
          Tout voir
        </Link>
      </div>
      <div className="mt-2.5 flex flex-col gap-0.5">
        {universeRows.map(({ entityType, counts, covers }) => (
          <Link
            key={entityType.id}
            to={`/tier-lists/general/${entityType.id}`}
            className="flex min-h-12 items-center gap-3 rounded-xl px-1.5 transition-colors hover:bg-rowHover"
          >
            <span className="flex shrink-0 gap-0.5">
              {covers.map((cover, i) =>
                cover ? (
                  <img key={i} src={cover} alt="" className="h-6 w-4 rounded-[3px] object-cover" />
                ) : (
                  <span key={i} className="h-6 w-4 rounded-[3px] bg-surface2" />
                ),
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-textPrimary">{entityType.label}</span>
            <span className="shrink-0 text-xs font-semibold text-textDim">
              {counts.ranked} classé{counts.ranked > 1 ? 's' : ''}
            </span>
            <ChevronRight size={15} className="shrink-0 text-textDim" />
          </Link>
        ))}
        {customLists.map((list) => (
          <Link
            key={list.id}
            to={`/tier-lists/${list.id}`}
            className="flex min-h-12 items-center gap-3 rounded-xl px-1.5 transition-colors hover:bg-rowHover"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-textPrimary">{list.name}</span>
            <span className="shrink-0 text-xs font-semibold text-textDim">
              {list.itemCount} élément{list.itemCount > 1 ? 's' : ''}
            </span>
            <ChevronRight size={15} className="shrink-0 text-textDim" />
          </Link>
        ))}
      </div>
    </div>
  )
}
