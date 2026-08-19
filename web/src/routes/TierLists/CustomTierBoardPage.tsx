import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { deleteTierList, getTierListDetail, setTierListItemRank } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TierBoard } from './TierBoard'
import { TierPicker } from './TierPicker'
import { AddTierListItemsPanel } from './AddTierListItemsPanel'
import type { TierListEntryDto } from '../../types/tierList'

/** Board d'une Tier List PERSONNALISÉE - même rendu que le classement
 * général (voir TierBoard), rangs actifs propres à cette liste (voir
 * TierList.activeRanks côté backend, configurables à la création). */
export function CustomTierBoardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeEntry, setActiveEntry] = useState<TierListEntryDto | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [addingItems, setAddingItems] = useState(false)

  const detailQuery = useQuery({ queryKey: queryKeys.tierLists.detail(id!), queryFn: () => getTierListDetail(id!) })

  const rankMutation = useMutation({
    mutationFn: (rank: TierListEntryDto['rank']) => setTierListItemRank(id!, activeEntry!.entityId, rank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
      setActiveEntry(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTierList(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.custom(detailQuery.data!.list.entityTypeId) })
      navigate('/discover')
    },
  })

  if (detailQuery.isError) return <ErrorBanner message={detailQuery.error.message} />
  if (detailQuery.isLoading || !detailQuery.data) return <p className="text-textDim">Chargement...</p>

  const { list, ranked, unranked } = detailQuery.data
  const rankedByRank = Object.fromEntries(list.activeRanks.map((r) => [r, ranked.filter((e) => e.rank === r)]))

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate('/discover')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Découvrir
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-textPrimary">{list.name}</h1>
          {list.description && <p className="mt-1 text-sm text-textDim">{list.description}</p>}
          <p className="mt-1 text-xs text-textDim">
            {list.rankedCount} classé{list.rankedCount > 1 ? 's' : ''} · {list.itemCount - list.rankedCount} à classer
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAddingItems(true)}
            className="flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accentText"
          >
            <Plus size={15} />
            Ajouter
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu de la Tier List"
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-textDim hover:bg-rowHover"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-surface2 bg-surface p-1.5 shadow-token-elevated">
                {!confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-dangerText hover:bg-dangerTint"
                  >
                    <Trash2 size={15} />
                    Supprimer cette Tier List
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 p-2">
                    <p className="text-xs text-textDim">Supprimer définitivement « {list.name} » ? Irréversible.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="flex-1 rounded-lg bg-danger px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Confirmer
                      </button>
                      <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2 py-1.5 text-xs text-textDim">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {addingItems && (
        <AddTierListItemsPanel
          tierListId={id!}
          entityTypeId={list.entityTypeId}
          alreadyAddedIds={new Set([...ranked, ...unranked].map((e) => e.entityId))}
          onClose={() => setAddingItems(false)}
        />
      )}

      {ranked.length === 0 && unranked.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface2 p-6 text-center">
          <p className="text-sm text-textDim">Aucune œuvre dans cette Tier List pour l'instant.</p>
        </div>
      ) : (
        <TierBoard ranked={rankedByRank} unranked={unranked} activeRanks={list.activeRanks} onSelectEntry={setActiveEntry} />
      )}

      {activeEntry && (
        <TierPicker
          open
          onClose={() => setActiveEntry(null)}
          title={activeEntry.title}
          coverImageUrl={activeEntry.coverImageUrl}
          activeRanks={list.activeRanks}
          currentRank={activeEntry.rank}
          onSelect={(rank) => rankMutation.mutate(rank)}
        />
      )}
    </div>
  )
}
