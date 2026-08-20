import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { searchEntities } from '../../api/entities'
import { listAllOwnerships } from '../../api/ownerships'
import { addTierListItems } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { isOwned, ownedVariantIds } from '../Shelf/ownership'
import { useModalA11y } from '../../lib/useModalA11y'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * Ajout d'œuvres à une Tier List personnalisée - étape explicite obligatoire
 * côté backend (voir TierListController.addItems : une Tier List perso ne
 * contient jamais implicitement "tout ce qui est possédé", contrairement au
 * classement général - voir GeneralTierBoardPage). Candidats = possédées de
 * l'univers de cette liste (même règle que ShelfPage - isOwned/ownedVariantIds)
 * et pas déjà dans la liste. Drawer desktop / feuille mobile, même patron
 * responsive que CollectionFilters/TierPicker.
 */
export function AddTierListItemsPanel({
  tierListId,
  entityTypeId,
  alreadyAddedIds,
  onClose,
}: {
  tierListId: string
  entityTypeId: string
  alreadyAddedIds: Set<string>
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Toujours monté "ouvert" par le parent (voir CustomTierBoardPage,
  // `{addingItems && <...>}`) - voir useModalA11y (Lot 9).
  const containerRef = useModalA11y<HTMLDivElement>(true, onClose)

  const entitiesQuery = useQuery({
    queryKey: queryKeys.entities.search({ entityTypeId }),
    queryFn: () => searchEntities({ entityTypeId }),
  })
  const ownershipsQuery = useQuery({ queryKey: queryKeys.allOwnerships, queryFn: listAllOwnerships })

  const candidates = useMemo(() => {
    if (!entitiesQuery.data || !ownershipsQuery.data) return []
    const owned = ownedVariantIds(ownershipsQuery.data)
    return entitiesQuery.data.filter(
      (e) => isOwned(e, ownershipsQuery.data, owned) && !alreadyAddedIds.has(e.id),
    )
  }, [entitiesQuery.data, ownershipsQuery.data, alreadyAddedIds])

  const addMutation = useMutation({
    mutationFn: () => addTierListItems(tierListId, [...selected]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(tierListId) })
      onClose()
    },
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tier-items-title"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-0 md:m-auto md:h-fit md:max-h-[85vh] md:w-[520px] md:rounded-2xl md:border md:border-surface2"
      >
        <div className="flex items-center justify-between gap-2 border-b border-surface2 p-4">
          <h2 id="add-tier-items-title" className="font-display text-base font-semibold text-textPrimary">
            Ajouter des œuvres
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full text-textDim hover:bg-rowHover">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}
          {(entitiesQuery.isLoading || ownershipsQuery.isLoading) && <p className="text-sm text-textDim">Chargement...</p>}

          {entitiesQuery.isSuccess && ownershipsQuery.isSuccess && candidates.length === 0 && (
            <p className="text-sm text-textDim">
              Tout ce que tu possèdes dans cet univers est déjà dans cette Tier List.
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {candidates.map((entity) => {
              const cover = coverImageUrlFrom(entity.attributes)
              const checked = selected.has(entity.id)
              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => toggle(entity.id)}
                  aria-pressed={checked}
                  className="flex flex-col gap-1.5 text-left"
                >
                  <span className={`relative aspect-[2/3] overflow-hidden rounded-lg ring-2 transition-colors ${checked ? 'ring-accent' : 'ring-transparent'}`}>
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-surface2 px-1 text-center text-[10px] text-textDim">
                        {entity.title}
                      </span>
                    )}
                    {checked && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentInk">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs font-medium text-textPrimary">{entity.title}</span>
                </button>
              )
            })}
          </div>

          {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}
        </div>

        <div className="border-t border-surface2 p-4">
          <button
            type="button"
            onClick={() => selected.size > 0 && addMutation.mutate()}
            disabled={selected.size === 0 || addMutation.isPending}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accentInk disabled:opacity-50"
          >
            {addMutation.isPending
              ? 'Ajout...'
              : selected.size > 0
                ? `Ajouter (${selected.size})`
                : 'Ajouter'}
          </button>
        </div>
      </div>
    </>
  )
}
