import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { createTierList } from '@/common/api/tierLists'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TierBadge } from '@/common/components/TierBadge'
import { useModalA11y } from '@/common/hooks/useModalA11y'
import { RANKS, type Rank } from '@/common/types/tierList'

/** "Nouvelle Tier List" - vrai flow minimal (nom, univers, rangs actifs,
 * description optionnelle - voir DS v1.1 §51), jamais un simple toast
 * descriptif. Le choix des éléments à ajouter se fait ensuite depuis le
 * board vide de la liste créée (pas dans ce même formulaire - garde la
 * création courte).
 * <p>
 * L'univers est un vrai choix depuis le Lot 14, "Toutes catégories" compris
 * (voir TierList côté backend, entityTypeId nullable) - avant, il était
 * imposé par le bouton d'où l'on venait et seulement rappelé en pastille.
 * L'appelant ne fait plus que proposer une valeur de départ. */
export function CreateTierListModal({
  entityTypeId: initialEntityTypeId,
  onClose,
}: {
  /** Univers présélectionné, null pour démarrer sur "Toutes catégories". */
  entityTypeId: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [entityTypeId, setEntityTypeId] = useState<string | null>(initialEntityTypeId)
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [activeRanks, setActiveRanks] = useState<Set<Rank>>(new Set(RANKS))
  // Toujours monté "ouvert" - c'est le parent qui monte/démonte ce composant
  // (voir TierListsScreen/DiscoverTierPreview, `{creatingFor && <...>}`) -
  // voir useModalA11y (Lot 9) pour ce style d'usage.
  const containerRef = useModalA11y<HTMLDivElement>(true, onClose)

  const createMutation = useMutation({
    mutationFn: () =>
      createTierList({
        name: name.trim(),
        entityTypeId,
        activeRanks: [...activeRanks],
        description: description.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.custom(entityTypeId) })
      navigate(`/tier-lists/${created.id}`)
    },
  })

  function toggleRank(rank: Rank) {
    setActiveRanks((prev) => {
      const next = new Set(prev)
      if (next.has(rank)) {
        if (next.size === 1) return prev // toujours au moins un rang actif
        next.delete(rank)
      } else {
        next.add(rank)
      }
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
        aria-labelledby="create-tier-list-title"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-0 md:m-auto md:h-fit md:max-h-[85vh] md:w-[420px] md:rounded-2xl md:border md:border-surface2"
      >
        <div className="flex items-center justify-between gap-2 border-b border-surface2 p-4">
          <h2 id="create-tier-list-title" className="font-display text-base font-semibold text-textPrimary">
            Nouvelle Tier List
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:bg-rowHover">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-textDim" htmlFor="tier-list-name">
              Nom
            </label>
            <input
              id="tier-list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Mes mangas préférés"
              data-modal-initial-focus
              className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-textDim">Univers</span>
            <div className="flex flex-wrap gap-2">
              {(entityTypesQuery.data ?? []).map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setEntityTypeId(type.id)}
                  aria-pressed={entityTypeId === type.id}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    entityTypeId === type.id ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
                  }`}
                >
                  {type.label}
                </button>
              ))}
              {/* "Toutes catégories" volontairement en DERNIER et visuellement
                  à part : mélanger les univers est le cas particulier, pas le
                  défaut - une liste sans univers doit être un choix assumé. */}
              <button
                type="button"
                onClick={() => setEntityTypeId(null)}
                aria-pressed={entityTypeId === null}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  entityTypeId === null ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
                }`}
              >
                Toutes catégories
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-textDim">Rangs actifs</span>
            <div className="flex flex-wrap gap-2">
              {RANKS.map((rank) => (
                <button
                  key={rank}
                  type="button"
                  onClick={() => toggleRank(rank)}
                  aria-pressed={activeRanks.has(rank)}
                  className={`transition-opacity ${activeRanks.has(rank) ? '' : 'opacity-30'}`}
                >
                  <TierBadge rank={rank} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-textDim" htmlFor="tier-list-description">
              Description (optionnel)
            </label>
            <textarea
              id="tier-list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {createMutation.isError && <ErrorBanner message={createMutation.error.message} />}
        </div>
        <div className="border-t border-surface2 p-4">
          <button
            type="button"
            onClick={() => name.trim() && createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accentInk disabled:opacity-50"
          >
            {createMutation.isPending ? 'Création...' : 'Créer la Tier List'}
          </button>
        </div>
      </div>
    </>
  )
}
