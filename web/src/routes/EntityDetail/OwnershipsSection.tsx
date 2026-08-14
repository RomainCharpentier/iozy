import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { deleteOwnership, markSold, updatePurchasePrice } from '../../api/ownerships'
import { lendOwnership, listActiveLoans, markLoanReturned } from '../../api/loans'
import { mergeVariantAttributes } from '../../api/entities'
import { searchVolumes } from '../../api/metadata'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { findBestCoverMatch } from '../Shelf/backfillCovers'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITION_LABELS, OWNERSHIP_STATUS_LABELS, type Condition } from '../../types/entityTypes'
import type { OwnershipResponse, VariantDto } from '../../types/api'

/** Trie les Ownership par numéro de tome (Manga) quand l'info est disponible,
 * pour afficher "Tome 1, Tome 2, Tome 3..." dans l'ordre plutôt que dans
 * l'ordre d'ajout (souvent différent : un tome manquant est fréquemment
 * complété plus tard). Les Ownership sans tome (jeu vidéo, jeu de société,
 * ou manga ajouté sans préciser de tome) restent dans leur ordre d'origine,
 * après celles qui en ont un.
 */
function sortByVolumeNumber(ownerships: OwnershipResponse[], variantsById: Map<string, VariantDto>) {
  return [...ownerships].sort((a, b) => {
    const volumeA = a.variantId ? variantsById.get(a.variantId)?.attributes.volumeNumber : undefined
    const volumeB = b.variantId ? variantsById.get(b.variantId)?.attributes.volumeNumber : undefined
    if (typeof volumeA === 'number' && typeof volumeB === 'number') return volumeA - volumeB
    if (typeof volumeA === 'number') return -1
    if (typeof volumeB === 'number') return 1
    return 0
  })
}

/** "YYYY-MM-DD" du jour, même format que LocalDateString côté backend. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OwnershipsSection({
  entityId,
  entityTypeId,
  entityTitle,
  ownerships,
  variants,
  highlightedVariantId,
}: {
  entityId: string
  entityTypeId: string
  entityTitle: string
  ownerships: OwnershipResponse[]
  variants: VariantDto[]
  // Présent quand on arrive depuis une tuile de tome précise dans "Ma
  // collection" (voir EntityDetailPage/ShelfPage) - fait défiler jusqu'à
  // cette ligne et la met brièvement en évidence, plutôt que de laisser
  // l'utilisateur chercher lui-même laquelle des possessions correspond au
  // tome sur lequel il vient de cliquer.
  highlightedVariantId?: string | null
}) {
  const queryClient = useQueryClient()
  const [lendFormOwnershipId, setLendFormOwnershipId] = useState<string | null>(null)
  const [borrowerName, setBorrowerName] = useState('')
  const [priceFormOwnershipId, setPriceFormOwnershipId] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')
  // "Modifier/recharger la jaquette" (voir demande "quand je clique sur un
  // tome... aucun moyen de recharger l'image ou de la modifier") - un seul
  // Variant édité à la fois, comme les autres formulaires inline de cette
  // section (prêt, prix).
  const [coverEditVariantId, setCoverEditVariantId] = useState<string | null>(null)
  const [coverUrlInput, setCoverUrlInput] = useState('')
  // "Supprimer cet exemplaire" - contrairement à Marquer vendu/perdu (statuts
  // réversibles), une suppression définitive : jamais un simple clic, voir
  // deleteMutation. Un seul exemplaire en confirmation à la fois, comme les
  // autres formulaires inline de cette section.
  const [deleteConfirmOwnershipId, setDeleteConfirmOwnershipId] = useState<string | null>(null)
  const highlightedRowRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (highlightedVariantId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Réagit à CHAQUE changement de highlightedVariantId, pas seulement au
    // montage : un clic sur un tome possédé dans la grille (voir
    // TomesGridSection/EntityDetailPage.onSelectOwnedVariant) met à jour
    // l'URL sans remonter la page, le défilement doit donc se redéclencher.
  }, [highlightedVariantId])

  const coverUrlMutation = useMutation({
    mutationFn: ({ variantId, coverImageUrl }: { variantId: string; coverImageUrl: string }) =>
      mergeVariantAttributes(entityId, variantId, { coverImageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setCoverEditVariantId(null)
      setCoverUrlInput('')
    },
  })

  // Retente une recherche Google Books pour CE tome précis uniquement (voir
  // backfillCovers.ts, même logique que "Retrouver les jaquettes
  // manquantes" côté Ma collection, mais ciblée sur un seul Variant plutôt
  // que tous ceux d'un coup) - forceRefresh direct : l'utilisateur vient de
  // cliquer explicitement pour réessayer, pas la peine de repasser d'abord
  // par le cache qui a justement pu déjà échouer (voir ShelfPage.tsx).
  const searchCoverMutation = useMutation({
    mutationFn: async (variant: VariantDto) => {
      const author = undefined // pas connu à ce niveau (attribut de l'Entity, pas du Variant) - recherche sans filtre auteur, comme un Variant sans candidat visuel à l'ajout.
      const response = await searchVolumes(entityTypeId, entityTitle, { author, forceRefresh: true })
      if (response.quotaExceeded) {
        throw new Error('Quota Google Books dépassé - réessaie plus tard.')
      }
      const match = findBestCoverMatch(response.volumes, variant)
      if (!match?.imageUrl) {
        throw new Error('Aucune jaquette trouvée pour ce tome sur Google Books.')
      }
      await mergeVariantAttributes(entityId, variant.id, { coverImageUrl: match.imageUrl })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setCoverEditVariantId(null)
    },
  })

  const sellMutation = useMutation({
    mutationFn: markSold,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) }),
  })

  const priceMutation = useMutation({
    mutationFn: ({ ownershipId, price }: { ownershipId: string; price: number | null }) =>
      updatePurchasePrice(ownershipId, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) })
      setPriceFormOwnershipId(null)
      setPriceInput('')
    },
  })

  // Bloquée côté backend (409) si un prêt référence encore cet exemplaire,
  // même déjà rendu (voir OwnershipDeletionService) - le message d'erreur
  // renvoyé explique déjà pourquoi, affiché tel quel plutôt que réinterprété.
  const deleteMutation = useMutation({
    mutationFn: deleteOwnership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) })
      setDeleteConfirmOwnershipId(null)
    },
  })

  // Prêts en cours tous propriétaires confondus (voir LoanController.active
  // côté backend) - filtrés côté client par ownershipId, une seule requête
  // plutôt qu'une par possession affichée (échelle d'une collection
  // personnelle, jamais des centaines de possessions actives à la fois).
  const activeLoansQuery = useQuery({ queryKey: queryKeys.loans.active, queryFn: listActiveLoans })
  const activeLoanByOwnershipId = new Map((activeLoansQuery.data ?? []).map((loan) => [loan.ownershipId, loan]))

  const lendMutation = useMutation({
    mutationFn: (ownershipId: string) =>
      lendOwnership({ ownershipId, borrowerName: borrowerName.trim(), lentAt: today() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loans.active })
      setLendFormOwnershipId(null)
      setBorrowerName('')
    },
  })

  const returnMutation = useMutation({
    mutationFn: markLoanReturned,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.loans.active }),
  })

  if (ownerships.length === 0) return null

  const variantsById = new Map(variants.map((v) => [v.id, v]))
  const sortedOwnerships = sortByVolumeNumber(ownerships, variantsById)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Possessions</h2>
      <ul className="flex flex-col gap-2">
        {sortedOwnerships.map((ownership) => {
          const variant = ownership.variantId ? variantsById.get(ownership.variantId) : undefined
          // Jaquette propre à ce tome (voir VolumeSelectionGrid côté Ajout
          // rapide) si elle a été trouvée à l'ajout - absente pour un tome
          // ajouté manuellement ou avant l'introduction de cette fonctionnalité.
          const variantCoverUrl = variant ? coverImageUrlFrom(variant.attributes) : null
          const activeLoan = activeLoanByOwnershipId.get(ownership.id)
          const isHighlighted = !!variant && variant.id === highlightedVariantId
          return (
            <li
              key={ownership.id}
              ref={isHighlighted ? highlightedRowRef : undefined}
              className={`flex items-center gap-3 rounded-xl bg-surface p-3 ${
                isHighlighted ? 'ring-2 ring-accent' : ''
              }`}
            >
              {variantCoverUrl ? (
                <img src={variantCoverUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
              ) : (
                variant && <span className="h-16 w-11 shrink-0 rounded bg-surface2" />
              )}
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    {/* Le libellé du tome (ex: "Tome 3 — Kana") prime sur l'état/statut
                        quand il est connu - c'est l'info qui distingue vraiment cette
                        ligne des autres Ownership de la même fiche. */}
                    {variant && <p className="font-medium text-textPrimary">{variant.label}</p>}
                    <p className="text-textPrimary">
                      {OWNERSHIP_STATUS_LABELS[ownership.status] ?? ownership.status} ·{' '}
                      {CONDITION_LABELS[ownership.condition as Condition] ?? ownership.condition}
                    </p>
                    <p className="text-textDim">Acquis le {ownership.acquiredAt}</p>
                    {priceFormOwnershipId !== ownership.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setPriceFormOwnershipId(ownership.id)
                          setPriceInput(ownership.purchasePrice !== null ? String(ownership.purchasePrice) : '')
                        }}
                        className="text-textDim underline-offset-2 hover:underline"
                      >
                        {ownership.purchasePrice !== null
                          ? `Prix d'achat : ${ownership.purchasePrice.toFixed(2)} €`
                          : "Ajouter le prix d'achat"}
                      </button>
                    )}
                    {variant && coverEditVariantId !== variant.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setCoverEditVariantId(variant.id)
                          setCoverUrlInput(variantCoverUrl ?? '')
                        }}
                        className="text-textDim underline-offset-2 hover:underline"
                      >
                        {variantCoverUrl ? 'Modifier la jaquette' : 'Ajouter une jaquette'}
                      </button>
                    )}
                    {ownership.note && <p className="text-textDim">{ownership.note}</p>}
                    {activeLoan && (
                      <p className="text-warning">
                        Prêté à {activeLoan.borrowerName} depuis le {activeLoan.lentAt}
                      </p>
                    )}
                    {deleteConfirmOwnershipId !== ownership.id && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOwnershipId(ownership.id)}
                        className="flex items-center gap-1 text-danger underline-offset-2 hover:underline"
                      >
                        <Trash2 size={11} />
                        Supprimer cet exemplaire
                      </button>
                    )}
                  </div>
                  {ownership.status === 'OWNED' && (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => sellMutation.mutate(ownership.id)}
                        disabled={sellMutation.isPending}
                        className="rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
                      >
                        Marquer vendu
                      </button>
                      {activeLoan ? (
                        <button
                          type="button"
                          onClick={() => returnMutation.mutate(activeLoan.id)}
                          disabled={returnMutation.isPending}
                          className="rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
                        >
                          Marquer rendu
                        </button>
                      ) : (
                        lendFormOwnershipId !== ownership.id && (
                          <button
                            type="button"
                            onClick={() => setLendFormOwnershipId(ownership.id)}
                            className="rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary"
                          >
                            Prêter
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                {lendFormOwnershipId === ownership.id && (
                  <div className="flex items-center gap-2">
                    <input
                      value={borrowerName}
                      onChange={(e) => setBorrowerName(e.target.value)}
                      placeholder="Prêté à qui ?"
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <button
                      type="button"
                      onClick={() => lendMutation.mutate(ownership.id)}
                      disabled={!borrowerName.trim() || lendMutation.isPending}
                      className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLendFormOwnershipId(null)
                        setBorrowerName('')
                      }}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {priceFormOwnershipId === ownership.id && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder="ex: 6.90"
                      autoFocus
                      className="w-24 min-w-0 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        priceMutation.mutate({
                          ownershipId: ownership.id,
                          price: priceInput.trim() ? Number(priceInput) : null,
                        })
                      }
                      disabled={priceMutation.isPending}
                      className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
                    >
                      OK
                    </button>
                    {ownership.purchasePrice !== null && (
                      <button
                        type="button"
                        onClick={() => priceMutation.mutate({ ownershipId: ownership.id, price: null })}
                        disabled={priceMutation.isPending}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
                      >
                        Effacer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPriceFormOwnershipId(null)
                        setPriceInput('')
                      }}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {variant && coverEditVariantId === variant.id && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={coverUrlInput}
                        onChange={(e) => setCoverUrlInput(e.target.value)}
                        placeholder="URL de l'image (ex: https://...)"
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                      <button
                        type="button"
                        onClick={() => coverUrlMutation.mutate({ variantId: variant.id, coverImageUrl: coverUrlInput.trim() })}
                        disabled={!coverUrlInput.trim() || coverUrlMutation.isPending}
                        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverEditVariantId(null)
                          setCoverUrlInput('')
                        }}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
                      >
                        Annuler
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => searchCoverMutation.mutate(variant)}
                      disabled={searchCoverMutation.isPending}
                      className="w-fit text-xs text-accent underline disabled:opacity-50"
                    >
                      {searchCoverMutation.isPending ? 'Recherche...' : 'Rechercher automatiquement sur Google Books'}
                    </button>
                    {searchCoverMutation.isError && (
                      <p className="text-xs text-textDim">{searchCoverMutation.error.message}</p>
                    )}
                  </div>
                )}

                {deleteConfirmOwnershipId === ownership.id && (
                  <div className="flex flex-col gap-1.5 rounded-lg bg-danger/10 p-2">
                    <p className="text-xs text-danger">
                      Supprimer définitivement {variant ? `« ${variant.label} »` : 'cet exemplaire'} ? Cette action
                      est irréversible.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(ownership.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-textPrimary disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmOwnershipId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-textDim"
                      >
                        Annuler
                      </button>
                    </div>
                    {deleteMutation.isError && deleteMutation.variables === ownership.id && (
                      <ErrorBanner message={deleteMutation.error.message} />
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
