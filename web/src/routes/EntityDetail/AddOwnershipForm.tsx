import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'

/**
 * Ajout CONTEXTUEL (voir VolumeInteractionPanel) : série/édition/numéro déjà
 * connus (le tome vient d'être cliqué dans la grille), il ne reste plus qu'à
 * ajouter la possession elle-même - jamais "recréer série + édition + tome"
 * (voir AddVolumeSection, qui reste le parcours MANUEL séparé, plus complet,
 * pour le cas où le tome n'est pas déjà visible dans la grille).
 * <p>
 * Réutilise `quickAdd` (même mutation que partout ailleurs dans l'app) avec
 * le titre/numéro/édition EXACTS du tome cliqué - le backend
 * (QuickAddService) matche déjà un Variant existant par ces 3 valeurs avant
 * d'en créer un nouveau (voir `matchedExistingVariant` dans la réponse) :
 * aucun risque de dupliquer le Variant catalogué d'un tome "catalogué
 * manquant", sans avoir besoin d'un endpoint dédié "ajouter une possession à
 * un variantId connu".
 */
export function AddOwnershipForm({
  entityId,
  entityTypeId,
  entityTitle,
  volumeNumber,
  edition,
}: {
  entityId: string
  entityTypeId: string
  entityTitle: string
  volumeNumber: number
  edition: string
}) {
  const queryClient = useQueryClient()
  const [condition, setCondition] = useState<Condition>('NEW')
  const [purchasePrice, setPurchasePrice] = useState('')

  const addMutation = useMutation({
    mutationFn: () =>
      quickAdd({
        entityTypeId,
        title: entityTitle,
        condition,
        volumeNumber,
        edition: edition || undefined,
        purchasePrice: purchasePrice.trim() ? Number(purchasePrice) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.allOwnerships })
      // La progression « X sur Y » vient du serveur depuis qu'elle n'est plus
      // recalculee ici : sans cette invalidation, Ma collection afficherait
      // encore l'ancien decompte apres un ajout.
      queryClient.invalidateQueries({ queryKey: queryKeys.insights.progress })
      // Ne ferme rien, ne navigue nulle part : le parent (voir
      // VolumeInteractionPanel) recalcule activeTile à partir des tuiles
      // fraîchement invalidées - le panneau passe seul en mode "owned" au
      // prochain rendu, sans action explicite à déclencher ici.
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-textDim">État</span>
        <div className="flex gap-2">
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-textDim" htmlFor="contextualPurchasePrice">
          Prix d'achat (optionnel)
        </label>
        <input
          id="contextualPurchasePrice"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="ex: 6.90"
          className="w-32 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}

      <button
        type="button"
        onClick={() => addMutation.mutate()}
        disabled={addMutation.isPending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk disabled:opacity-50"
      >
        {addMutation.isPending ? 'Ajout...' : 'Ajouter à ma collection'}
      </button>
    </div>
  )
}
