import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import {
  createEditionUpgradeWish,
  deleteEditionUpgradeWish,
  listEditionUpgradeWishesForEntity,
} from '../../api/editionUpgrade'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * "Je possède déjà cette édition, mais j'en cherche une meilleure" - seul
 * point de création d'une EditionUpgradeWish dans toute l'app.
 * <p>
 * Il en existait un avant la refonte V1.2, porté par `SeriesCompletenessSection`
 * (supprimée au Lot 5) : depuis, `/edition-upgrades` et son entrée dans Profil
 * survivaient sans que rien ne puisse plus alimenter la liste - un écran
 * condamné à rester vide (voir docs/DESIGN_MIGRATION_V1.2.md, Lot 27).
 * <p>
 * Placé ici plutôt que dans "Plus d'options" : l'envie porte sur l'ÉDITION
 * ACTIVE, dont le nom est le premier champ de la requête - la même ligne qui
 * annonce "Cette édition est épuisée" / "Nouvelle édition annoncée" est
 * exactement le moment où l'envie se forme. Rattaché à l'édition affichée,
 * donc absent tant qu'aucune édition n'est nommée (`activeGroup.edition` vide) :
 * une envie de remplacer "l'édition non précisée" ne veut rien dire.
 */
export function EditionUpgradeWishToggle({ entityId, editionName }: { entityId: string; editionName: string }) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [desiredEdition, setDesiredEdition] = useState('')
  const [note, setNote] = useState('')

  const wishesQuery = useQuery({
    queryKey: queryKeys.editionUpgradeWishes.byEntity(entityId),
    queryFn: () => listEditionUpgradeWishesForEntity(entityId),
  })
  // Une envie par édition possédée : chercher mieux que l'édition standard
  // n'a rien à voir avec chercher mieux que la Perfect Edition, même série.
  const wish = (wishesQuery.data ?? []).find((w) => w.currentEditionName === editionName)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.editionUpgradeWishes.byEntity(entityId) })
    // La page "Envies d'amélioration" (Profil) lit une clé séparée - sans
    // ça, elle continue d'afficher l'état d'avant.
    queryClient.invalidateQueries({ queryKey: queryKeys.editionUpgradeWishes.all })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createEditionUpgradeWish({
        entityId,
        currentEditionName: editionName,
        desiredEditionName: desiredEdition.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setDesiredEdition('')
      setNote('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => deleteEditionUpgradeWish(wish!.id),
    onSuccess: invalidate,
  })

  if (wish) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-textDim">
        <Sparkles size={12} className="shrink-0 text-accentText" />
        <span>
          Tu cherches une meilleure édition
          {wish.desiredEditionName && ` (${wish.desiredEditionName})`}
        </span>
        <button
          type="button"
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          className="underline hover:text-textPrimary disabled:opacity-50"
        >
          Annuler
        </button>
        {removeMutation.isError && <ErrorBanner message={removeMutation.error.message} />}
      </div>
    )
  }

  if (!formOpen) {
    return (
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="flex w-fit items-center gap-1.5 text-xs text-textDim underline hover:text-textPrimary"
      >
        <Sparkles size={12} className="shrink-0" />
        Je cherche une meilleure édition
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface2 p-3">
      {/* Les deux champs sont facultatifs côté domaine (EditionUpgradeWish) :
          "je veux mieux que ça, je ne sais pas encore quoi" est un état
          légitime - le bouton n'est donc jamais désactivé. */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-textDim" htmlFor={`desired-edition-${entityId}`}>
          Édition recherchée (facultatif)
        </label>
        <input
          id={`desired-edition-${entityId}`}
          value={desiredEdition}
          onChange={(e) => setDesiredEdition(e.target.value)}
          placeholder="Perfect Edition, Collector…"
          autoFocus
          className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-textDim" htmlFor={`upgrade-note-${entityId}`}>
          Note (facultatif)
        </label>
        <input
          id={`upgrade-note-${entityId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Attendre une promo, revendre l'ancienne…"
          className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
        >
          {createMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => setFormOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs text-textDim"
        >
          Annuler
        </button>
      </div>
      {createMutation.isError && <ErrorBanner message={createMutation.error.message} />}
    </div>
  )
}
