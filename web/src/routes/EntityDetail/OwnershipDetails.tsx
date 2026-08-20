import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { deleteOwnership, markSold, updatePurchasePrice } from '../../api/ownerships'
import { lendOwnership, listActiveLoans, markLoanReturned } from '../../api/loans'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import type { OwnershipResponse } from '../../types/api'

/** "YYYY-MM-DD" du jour, même format que LocalDateString côté backend. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Une ligne "Exemplaire" - extrait de l'ancien OwnershipsSection (mêmes
 * mutations, même comportement), mais recentré sur UN SEUL tome à la fois :
 * plus de liste de toutes les possessions de la série ni de mise en évidence
 * par scroll, ce composant reçoit déjà exactement les Ownership du Variant
 * concerné (voir VolumeInteractionPanel). Menu secondaire "..." replié par
 * défaut (voir §"ne pas exposer toutes les actions directement") plutôt que
 * Marquer vendu/Prêter/Supprimer en boutons visibles en permanence. */
function OwnershipRow({ ownership, entityId }: { ownership: OwnershipResponse; entityId: string }) {
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [lending, setLending] = useState(false)
  const [borrowerName, setBorrowerName] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.allOwnerships })
  }

  const activeLoansQuery = useQuery({ queryKey: queryKeys.loans.active, queryFn: listActiveLoans })
  const activeLoan = (activeLoansQuery.data ?? []).find((loan) => loan.ownershipId === ownership.id)

  const sellMutation = useMutation({
    mutationFn: () => markSold(ownership.id),
    onSuccess: () => {
      invalidateAll()
      setMenuOpen(false)
    },
  })
  const priceMutation = useMutation({
    mutationFn: (price: number | null) => updatePurchasePrice(ownership.id, price),
    onSuccess: () => {
      invalidateAll()
      setEditingPrice(false)
    },
  })
  const lendMutation = useMutation({
    mutationFn: () => lendOwnership({ ownershipId: ownership.id, borrowerName: borrowerName.trim(), lentAt: today() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.active })
      setLending(false)
      setBorrowerName('')
      setMenuOpen(false)
    },
  })
  const returnMutation = useMutation({
    mutationFn: () => markLoanReturned(activeLoan!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.loans.active }),
  })
  // Bloquée côté backend (409) si un prêt référence encore cet exemplaire,
  // même déjà rendu (voir OwnershipDeletionService) - le message d'erreur
  // renvoyé explique déjà pourquoi, affiché tel quel.
  const deleteMutation = useMutation({
    mutationFn: () => deleteOwnership(ownership.id),
    onSuccess: () => invalidateAll(),
  })

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <p className="text-textPrimary">
            {CONDITION_LABELS[ownership.condition as Condition] ?? ownership.condition}
          </p>
          <p className="text-textDim">Acquis le {ownership.acquiredAt}</p>
          <p className="text-textDim">
            {ownership.purchasePrice !== null ? `Prix payé : ${ownership.purchasePrice.toFixed(2)} €` : 'Prix payé : —'}
          </p>
          {activeLoan && <p className="text-warning">Prêté à {activeLoan.borrowerName} depuis le {activeLoan.lentAt}</p>}
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Actions sur cet exemplaire"
          className="shrink-0 rounded-full p-1 text-textDim hover:bg-surface hover:text-textPrimary"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Menu secondaire replié par défaut - expansion inline plutôt qu'un
          popover flottant : reste correct même à l'intérieur d'un panneau
          scrollable (drawer/bottom-sheet), sans logique de positionnement/
          clipping supplémentaire à gérer. */}
      {menuOpen && !editingPrice && !lending && !confirmingDelete && (
        <div className="flex flex-col gap-1 border-t border-surface pt-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setPriceInput(ownership.purchasePrice !== null ? String(ownership.purchasePrice) : '')
              setEditingPrice(true)
            }}
            className="w-fit text-textDim hover:text-textPrimary"
          >
            Modifier ma copie
          </button>
          {ownership.status === 'OWNED' && !activeLoan && (
            <button type="button" onClick={() => setLending(true)} className="w-fit text-textDim hover:text-textPrimary">
              Prêter
            </button>
          )}
          {activeLoan && (
            <button
              type="button"
              onClick={() => returnMutation.mutate()}
              disabled={returnMutation.isPending}
              className="w-fit text-textDim hover:text-textPrimary disabled:opacity-50"
            >
              Marquer rendu
            </button>
          )}
          {ownership.status === 'OWNED' && (
            <button
              type="button"
              onClick={() => sellMutation.mutate()}
              disabled={sellMutation.isPending}
              className="w-fit text-textDim hover:text-textPrimary disabled:opacity-50"
            >
              Marquer vendu
            </button>
          )}
          <button type="button" onClick={() => setConfirmingDelete(true)} className="w-fit text-danger hover:underline">
            Supprimer cet exemplaire
          </button>
        </div>
      )}

      {editingPrice && (
        <div className="flex items-center gap-2 border-t border-surface pt-2">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="Prix d'achat"
            autoFocus
            className="w-28 min-w-0 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => priceMutation.mutate(priceInput.trim() ? Number(priceInput) : null)}
            disabled={priceMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingPrice(false)
              setMenuOpen(false)
            }}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
          >
            Annuler
          </button>
        </div>
      )}

      {lending && (
        <div className="flex items-center gap-2 border-t border-surface pt-2">
          <input
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            placeholder="Prêté à qui ?"
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => lendMutation.mutate()}
            disabled={!borrowerName.trim() || lendMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => {
              setLending(false)
              setMenuOpen(false)
            }}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
          >
            Annuler
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className="flex flex-col gap-1.5 border-t border-danger/20 pt-2">
          <p className="text-xs text-danger">Supprimer définitivement cet exemplaire ? Cette action est irréversible.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-dangerInk disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false)
                setMenuOpen(false)
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-textDim"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {(sellMutation.isError || deleteMutation.isError) && (
        <ErrorBanner message={(sellMutation.error ?? deleteMutation.error)!.message} />
      )}
    </div>
  )
}

/**
 * "Ma copie" (1 exemplaire) ou "Mes exemplaires" (plusieurs) - jamais
 * "Ownership"/"Possessions", du vocabulaire technique qui n'a pas sa place
 * dans une fiche de consultation normale (voir VolumeInteractionPanel). Un
 * exemplaire "vendu"/"perdu" reste affiché ici (voir ownerships ci-dessous,
 * pas filtré) : l'historique est réel, jamais caché silencieusement.
 */
export function OwnershipDetails({ ownerships, entityId }: { ownerships: OwnershipResponse[]; entityId: string }) {
  if (ownerships.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-textPrimary">{ownerships.length > 1 ? 'Mes exemplaires' : 'Ma copie'}</h3>
      <div className="flex flex-col gap-2">
        {ownerships.map((ownership) => (
          <OwnershipRow key={ownership.id} ownership={ownership} entityId={entityId} />
        ))}
      </div>
    </div>
  )
}
