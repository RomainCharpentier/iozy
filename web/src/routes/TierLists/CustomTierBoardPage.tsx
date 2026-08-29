import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { retourDepuis } from '../../lib/retour'
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import {
  addTierListItems,
  deleteTierList,
  getTierListDetail,
  removeTierListItem,
  setTierListItemRank,
  updateTierList,
} from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TierBoard } from './TierBoard'
import { TierPicker } from './TierPicker'
import { AddTierListItemsPanel } from './AddTierListItemsPanel'
import { useQuickRank } from './useQuickRank'
import { useModalA11y } from '../../lib/useModalA11y'
import { useToast } from '../../lib/toast'
import type { Rank, TierListEntryDto } from '../../types/tierList'
import { EnTeteSection } from '../../components/EnTeteSection'

/** Board d'une Tier List PERSONNALISÉE - même rendu que le classement
 * général (voir TierBoard), rangs actifs propres à cette liste (voir
 * TierList.activeRanks côté backend, configurables à la création). */
export function CustomTierBoardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // Nommé par l'écran d'origine quand il le passe, sinon le parent naturel.
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
  // Le "..." menu est un `role="dialog"` au même titre que les autres
  // surfaces temporaires de l'app (voir la maquette, dlg-tiermenu) - Escape +
  // piège de focus + focus rendu au bouton "..." (voir useModalA11y, Lot 9).
  const menuRef = useModalA11y<HTMLDivElement>(menuOpen, () => setMenuOpen(false))

  const detailQuery = useQuery({ queryKey: queryKeys.tierLists.detail(id!), queryFn: () => getTierListDetail(id!) })

  const rankMutation = useMutation({
    mutationFn: ({ entityId, rank }: { entityId: string; rank: Rank | null }) => setTierListItemRank(id!, entityId, rank),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(variables.entityId) })
      // Classement rapide : enchaîner sur l'œuvre suivante remplace la
      // fermeture du sélecteur (voir useQuickRank).
      if (quickRank.isActive) quickRank.next()
      else setActiveEntry(null)
    },
  })

  // Retirer une œuvre de la liste - distinct de setTierListItemRank(null), qui
  // ne fait que la déclasser. Sans ça, un ajout par erreur depuis
  // AddTierListItemsPanel n'avait aucune sortie (DELETE /tier-lists/{id}/items/
  // {entityId} existait pourtant depuis le Lot 7).
  const removeItemMutation = useMutation({
    // L'entrée entière, pas seulement son identifiant : son RANG est ce qu'on
    // doit pouvoir rendre, et il n'existe plus une fois l'œuvre retirée.
    mutationFn: (entree: TierListEntryDto) => removeTierListItem(id!, entree.entityId),
    onSuccess: (_result, entree) => {
      invaliderApresItem(entree.entityId)
      quickRank.stop()
      setActiveEntry(null)
      // Même convention que les envies, les prix relevés et les expériences.
      // Restauration réelle : l'appartenance ET le rang, en deux appels - le
      // second n'a lieu que si l'œuvre était classée.
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

  /** La fiche de l'œuvre affiche ses appartenances (voir TomesGridSection) :
   *  sans cette invalidation, elle continuerait d'annoncer cette liste. */
  function invaliderApresItem(entityId: string) {
    queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
    queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(entityId) })
  }

  // PATCH /tier-lists/{id} existait sans appelant : une faute de frappe dans le
  // nom d'une liste était définitive, la seule sortie étant de la supprimer et
  // de tout réajouter.
  const renameMutation = useMutation({
    mutationFn: (name: string) => updateTierList(id!, { name }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.detail(id!) })
      // Le nom se lit aussi depuis la liste des Tier Lists de cet univers et
      // depuis la fiche d'une œuvre (entitySummary porte tierListName).
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.custom(updated.entityTypeId) })
      queryClient.invalidateQueries({ queryKey: ['tierLists', 'entitySummary'] })
      setRenaming(false)
      setMenuOpen(false)
    },
  })

  // Pas d'« Annuler » ici, délibérément : supprimer une Tier List passe déjà par
  // une confirmation en deux temps qui annonce « Irréversible ». Ajouter une
  // annulation ferait mentir cette phrase, et protégerait une deuxième fois un
  // geste que personne ne déclenche par mégarde. Le filet va aux gestes NUS -
  // retirer une œuvre de la liste, ci-dessus, part au premier clic.
  const deleteMutation = useMutation({
    mutationFn: () => deleteTierList(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.custom(detailQuery.data!.list.entityTypeId) })
      navigate('/tier-lists')
    },
  })

  if (detailQuery.isError) return <ErrorBanner message={detailQuery.error.message} />
  if (detailQuery.isLoading || !detailQuery.data) return <p className="text-textDim">Chargement...</p>

  const { list, ranked, unranked } = detailQuery.data
  const rankedByRank = Object.fromEntries(list.activeRanks.map((r) => [r, ranked.filter((e) => e.rank === r)]))
  const selectedEntry = quickRank.isActive ? quickRank.current : activeEntry


  return (
    <div className="flex flex-col gap-4">
      {/* La destination vient de CELUI QUI A OUVERT cet écran, quand il la
          nomme (voir lib/retour) : un board ouvert depuis Découvrir y
          revenait autrefois par Tier Lists, et le bouton Précédent du
          navigateur disait alors autre chose que celui de la page (UX-8).
          Le défaut ci-dessous reste le parent naturel - lien reçu, F5. */}
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
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm"
            >
              <Zap size={15} />
              Classer rapidement ({unranked.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddingItems(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accentInk"
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
                      className="rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary focus:ring-2 focus:ring-accent/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => renameMutation.mutate(nameInput.trim())}
                        disabled={!nameInput.trim() || renameMutation.isPending}
                        className="flex-1 rounded-lg bg-accent px-2 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
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
