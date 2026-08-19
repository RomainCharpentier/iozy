import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ListOrdered, Plus } from 'lucide-react'
import { listEntityTypes } from '../../api/entityTypes'
import { getGeneralBoard, listTierLists } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CreateTierListModal } from '../TierLists/CreateTierListModal'
import type { GeneralBoardDto, TierListDto } from '../../types/tierList'

function countBoard(board: GeneralBoardDto | undefined): { ranked: number; total: number } {
  if (!board) return { ranked: 0, total: 0 }
  const ranked = Object.values(board.ranked).reduce((sum, entries) => sum + (entries?.length ?? 0), 0)
  return { ranked, total: ranked + board.unranked.length }
}

/**
 * Hub "Tier Lists" de Découvrir (voir DS v1.1 §44-46) : un classement
 * général par univers réellement possédé (candidats = toute œuvre possédée
 * de ce type, voir TierListService.ownedEntitiesOfType côté backend) + les
 * Tier Lists personnalisées de chaque univers + un point d'entrée de
 * création par univers - jamais un flux générique qui mélangerait les
 * univers. Un univers sans aucune œuvre possédée ET sans aucune Tier List
 * perso n'apparaît pas (même principe que groupByEntityType côté Ma
 * collection - jamais une section vide).
 */
export function TierListsHub() {
  const [creatingFor, setCreatingFor] = useState<{ id: string; label: string } | null>(null)

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

  const sections = entityTypes
    .map((entityType, i) => ({
      entityType,
      board: countBoard(boardQueries[i].data),
      lists: listsQueries[i].data ?? ([] as TierListDto[]),
    }))
    .filter((s) => s.board.total > 0 || s.lists.length > 0)

  return (
    <div className="flex flex-col gap-6">
      {sections.length === 0 && (
        <div className="rounded-2xl border border-surface2 bg-surface p-8 text-center">
          <p className="font-display text-base font-semibold text-textPrimary">Rien à classer pour l'instant</p>
          <p className="mt-1.5 text-sm text-textDim">Ajoute des œuvres à ta collection pour commencer à les classer.</p>
        </div>
      )}

      {sections.map(({ entityType, board, lists }) => {
        const visual = getEntityTypeVisual(entityType.code)
        return (
          <div key={entityType.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
              <h2 className="font-display text-base font-semibold text-textPrimary">{entityType.label}</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {board.total > 0 && (
                <Link
                  to={`/tier-lists/general/${entityType.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-surface2 bg-surface p-3.5 transition-transform hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold text-textPrimary">
                    <ListOrdered size={16} className="text-textDim" />
                    Classement général
                  </span>
                  <span className="shrink-0 text-xs text-textDim">
                    {board.ranked}/{board.total}
                  </span>
                </Link>
              )}

              {lists.map((list) => (
                <Link
                  key={list.id}
                  to={`/tier-lists/${list.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-surface2 bg-surface p-3.5 transition-transform hover:-translate-y-0.5"
                >
                  <span className="truncate text-sm font-semibold text-textPrimary">{list.name}</span>
                  <span className="shrink-0 text-xs text-textDim">
                    {list.rankedCount}/{list.itemCount}
                  </span>
                </Link>
              ))}

              <button
                type="button"
                onClick={() => setCreatingFor({ id: entityType.id, label: entityType.label })}
                className="flex items-center gap-2 rounded-xl border border-dashed border-lineStrong p-3.5 text-sm font-semibold text-textDim transition-colors hover:bg-rowHover"
              >
                <Plus size={16} />
                Nouvelle Tier List
              </button>
            </div>
          </div>
        )
      })}

      {creatingFor && (
        <CreateTierListModal
          entityTypeId={creatingFor.id}
          entityTypeLabel={creatingFor.label}
          onClose={() => setCreatingFor(null)}
        />
      )}
    </div>
  )
}
