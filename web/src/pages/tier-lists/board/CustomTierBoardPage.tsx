import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { retourDepuis } from '@/common/lib/retour'
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import {
  addTierListItems,
  deleteTierList,
  getTierListDetail,
  removeTierListItem,
  setTierListItemRank,
  updateTierList,
} from '@/common/api/tierLists'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TierBoard } from '@/pages/tier-lists/TierBoard'
import { TierPicker } from '@/common/components/TierPicker'
import { AddTierListItemsPanel } from '@/pages/tier-lists/AddTierListItemsPanel'
import { useQuickRank } from '@/pages/tier-lists/useQuickRank'
import { useModalA11y } from '@/common/hooks/useModalA11y'
import { useToast } from '@/common/lib/toast'
import type { Rank, TierListEntryDto } from '@/common/types/tierList'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { Squelette } from '@/common/components/Squelette'

/** Board of a CUSTOM Tier List - same rendering as the general
 * ranking (see TierBoard), active ranks specific to this list (see
 * TierList.activeRanks on the backend side, configurable at creation). */
export function CustomTierBoardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // Named by the screen of origin when it passes it, otherwise the natural parent.
  const retour = retourDepuis(useLocation().state) ?? { to: '/tier-lists', libelle: 'Tier Lists' }
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeEntry, setActiveEntry] = useState<TierListEntryDto | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [addingItems, setAddingItems] = useState(false)
  const quickRank = useQuickRank()
  // The "..." menu is a `role="dialog"` just like the other temporary
  // surfaces of the app (see the mockup, dlg-tiermenu) - Escape +
  // focus trap + focus returned to the "..." button (see useModalA11y, batch 9).
  const menuRef = useModalA11y<HTMLDivElement>(menuOpen, () => setMenuOpen(false))

  const detailQuery = useQuery({ queryKey: queryKeys.tierLists.detail(id!), queryFn: () => getTierListDetail(id!) })

  const rankMutation = useMutation({
    mutationFn: ({ entityId, rank }: { entityId: string; rank: Rank | null }) => setTierListItemRank(id!, entityId, rank),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(variables.entityId) })
      // Quick ranking: chaining to the next work replaces the
      // closing of the picker (see useQuickRank).
      if (quickRank.isActive) quickRank.next()
      else setActiveEntry(null)
    },
  })

  // Removing a work from the list - distinct from setTierListItemRank(null), which
  // only unranks it. Without it, an add by mistake from
  // AddTierListItemsPanel had no way out (DELETE /tier-lists/{id}/items/
  // {entityId} existed though since batch 7).
  const removeItemMutation = useMutation({
    // The whole entry, not only its identifier: its RANK is what must
    // be possible to restore, and it no longer exists once the work is removed.
    mutationFn: (entree: TierListEntryDto) => removeTierListItem(id!, entree.entityId),
    onSuccess: (_result, entree) => {
      invaliderApresItem(entree.entityId)
      quickRank.stop()
      setActiveEntry(null)
      // Same convention as the wishes, the recorded prices and the experiences.
      // Real restoration: the membership AND the rank, in two calls - the
      // second only takes place if the work was ranked.
      toast('Œuvre retirée de la liste', {
        label: 'Annuler',
        onAction: async () => {
          await addTierListItems(id!, [entree.entityId])
          if (entree.rank) await setTierListItemRank(id!, entree.entityId, entree.rank)
          invaliderApresItem(entree.entityId)
        },
      })
    },
  })

  /** The detail page of the work shows its memberships (see TomesGridSection):
   *  without this invalidation, it would keep announcing this list. */
  function invaliderApresItem(entityId: string) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(entityId) })
  }

  // PATCH /tier-lists/{id} existed without a caller: a typo in the
  // name of a list was final, the only way out being to delete it and
  // add everything again.
  const renameMutation = useMutation({
    mutationFn: (name: string) => updateTierList(id!, { name }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
      // The name is also read from the list of Tier Lists of this universe and
      // from the detail page of a work (entitySummary carries tierListName).
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.custom(updated.entityTypeId) })
      queryClient.invalidateQueries({ queryKey: ['tierLists', 'entitySummary'] })
      setRenaming(false)
      setMenuOpen(false)
    },
  })

  // No "Annuler" here, deliberately: deleting a Tier List already goes through
  // a two-step confirmation that announces "Irréversible". Adding a
  // cancel would make this sentence lie, and would protect a second time a
  // gesture that nobody triggers by mistake. The safety net goes to the BARE gestures -
  // removing a work from the list, above, goes through at the first click.
  const deleteMutation = useMutation({
    mutationFn: () => deleteTierList(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.custom(detailQuery.data!.list.entityTypeId) })
      navigate('/tier-lists')
    },
  })

  if (detailQuery.isError) return <ErrorBanner message={detailQuery.error.message} />
  if (detailQuery.isLoading || !detailQuery.data) return <Squelette lignes={3} />

  const { list, ranked, unranked } = detailQuery.data
  const rankedByRank = Object.fromEntries(list.activeRanks.map((r) => [r, ranked.filter((e) => e.rank === r)]))
  const selectedEntry = quickRank.isActive ? quickRank.current : activeEntry


  return (
    <div className="flex flex-col gap-4">
      {/* The destination comes from WHOEVER OPENED this screen, when they
          name it (see lib/retour): a board opened from Découvrir used to
          go back to it through Tier Lists, and the Previous button of the
          browser then said something different from the one of the page (UX-8).
          The default below stays the natural parent - received link, F5. */}
      <button
        type="button"
        onClick={() => navigate(retour.to)}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim"
      >
        <ArrowLeft size={15} />
        {retour.libelle}
      </button>

      <div className="flex items-start justify-between gap-3">
        <EnTeteSection
          niveau={1}
          titre={list.name}
          className="flex-1"
          sousTitre={
            <>
              {list.description && <span className="block">{list.description}</span>}
              {list.rankedCount} classé{list.rankedCount > 1 ? 's' : ''} · {list.itemCount - list.rankedCount} à
              classer
            </>
          }
        />
        <div className="flex shrink-0 items-center gap-2">
          {unranked.length > 0 && (
            <button
              type="button"
              onClick={() => quickRank.start(unranked)}
              className="btn-secondaire"
            >
              <Zap size={15} />
              Classer rapidement ({unranked.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddingItems(true)}
            className="btn-primaire"
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
              <div
                ref={menuRef}
                role="dialog"
                aria-modal="true"
                aria-label="Menu de la Tier List"
                className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-surface2 bg-surface p-1.5 shadow-token-elevated"
              >
                {renaming ? (
                  <div className="flex flex-col gap-2 p-2">
                    <label className="text-xs text-textDim" htmlFor="tier-list-name">
                      Nom de la Tier List
                    </label>
                    <input
                      id="tier-list-name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      autoFocus
                      className="champ"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => renameMutation.mutate(nameInput.trim())}
                        disabled={!nameInput.trim() || renameMutation.isPending}
                        className="btn-primaire flex-1"
                      >
                        Enregistrer
                      </button>
                      <button type="button" onClick={() => setRenaming(false)} className="rounded-lg px-2 py-1.5 text-xs text-textDim">
                        Annuler
                      </button>
                    </div>
                    {renameMutation.isError && <ErrorBanner message={renameMutation.error.message} />}
                  </div>
                ) : !confirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setNameInput(list.name)
                        setRenaming(true)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-textPrimary hover:bg-rowHover"
                    >
                      <Pencil size={15} />
                      Renommer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-dangerText hover:bg-dangerTint"
                    >
                      <Trash2 size={15} />
                      Supprimer cette Tier List
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 p-2">
                    <p className="text-xs text-textDim">Supprimer définitivement « {list.name} » ? Irréversible.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="flex-1 rounded-lg bg-danger px-2 py-1.5 text-xs font-semibold text-dangerInk disabled:opacity-50"
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
        <TierBoard
          ranked={rankedByRank}
          unranked={unranked}
          activeRanks={list.activeRanks}
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
          activeRanks={list.activeRanks}
          currentRank={selectedEntry.rank}
          onSelect={(rank) => rankMutation.mutate({ entityId: selectedEntry.entityId, rank })}
          progress={quickRank.progress}
          onSkip={quickRank.isActive ? quickRank.next : undefined}
          onRemoveFromList={() => removeItemMutation.mutate(selectedEntry)}
        />
      )}
    </div>
  )
}
