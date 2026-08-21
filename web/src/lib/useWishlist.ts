import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToWishlist, listWishlist, removeFromWishlist } from '../api/wishlist'
import { useToast } from '../components/Toast'
import { queryKeys } from './queryKeys'

/**
 * SOURCE UNIQUE du comportement « Envies ».
 *
 * Toutes les surfaces qui affichent ou modifient les envies passent par ici :
 * la fiche d'une œuvre, les résultats de recherche déjà possédés, le menu du
 * scan, l'écran Envies lui-même et le badge des en-têtes. Elles partagent donc
 * le même état (« Dans vos envies » vs « Ajouter aux envies »), la même
 * invalidation de cache et le même retour visuel - impossible de dériver.
 *
 * L'ajout n'avait qu'UN seul appelant dans toute l'application (le résultat
 * d'une analyse d'achat), alors que l'écran Envies, son badge et son lien de
 * partage existaient tous : voir docs/USER_JOURNEYS.md, UX-2.
 *
 * **Annulation réelle, jamais décorative** : annuler un ajout supprime l'entrée
 * qui vient d'être créée (son id vient de la réponse du POST) ; annuler un
 * retrait recrée l'entrée pour la même œuvre. Les deux restaurent vraiment
 * l'état précédent, c'est pourquoi « Annuler » est proposé dans les deux sens.
 *
 * Contrainte à connaître : une entrée de wishlist référence une œuvre EXISTANTE
 * (`POST /wishlist` exige un `entityId`). Une œuvre trouvée par une recherche
 * externe ou un scan mais absente de la collection ne peut donc pas être mise
 * en envies - il n'existe aucun moyen de créer une fiche sans possession.
 */
export function useWishlist() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: queryKeys.wishlist.all, queryFn: listWishlist })
  const entries = query.data ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
  }

  const addMutation = useMutation({
    mutationFn: (entityId: string) => addToWishlist(entityId),
    onSuccess: (created) => {
      invalidate()
      toast('Ajouté aux envies', {
        label: 'Annuler',
        onAction: () => removeMutation.mutate({ entryId: created.id, entityId: created.entityId, silencieux: true }),
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ entryId }: { entryId: string; entityId: string; silencieux?: boolean }) =>
      removeFromWishlist(entryId),
    onSuccess: (_result, variables) => {
      invalidate()
      // `silencieux` = ce retrait EST l'annulation d'un ajout : reproposer
      // « Annuler » ferait boucler l'utilisateur entre deux messages.
      if (variables.silencieux) return
      toast('Retiré des envies', {
        label: 'Annuler',
        onAction: () => addMutation.mutate(variables.entityId),
      })
    },
  })

  /**
   * Ajout groupé (résultat d'une analyse d'achat : toutes les séries connues du
   * lot). Un seul message pour l'ensemble, et une annulation qui retire
   * exactement les entrées créées - avant, ce bouton ajoutait en masse « sans
   * confirmation, sans message de retour et sans indiquer combien ont été
   * ajoutées » (docs/USER_JOURNEYS.md, UX-4).
   */
  const addManyMutation = useMutation({
    mutationFn: async (entityIds: string[]) => {
      const nouveaux = []
      for (const entityId of entityIds) {
        nouveaux.push(await addToWishlist(entityId))
      }
      return nouveaux
    },
    onSuccess: (crees) => {
      invalidate()
      if (crees.length === 0) return
      toast(crees.length === 1 ? 'Ajouté aux envies' : `${crees.length} séries ajoutées aux envies`, {
        label: 'Annuler',
        onAction: async () => {
          for (const entree of crees) {
            await removeFromWishlist(entree.id)
          }
          invalidate()
        },
      })
    },
  })

  const byEntityId = new Map(entries.map((entry) => [entry.entityId, entry]))

  return {
    /** Nombre d'envies - alimente le badge des en-têtes. */
    count: entries.length,
    entries,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    /** L'entrée de wishlist pour cette œuvre, ou undefined. */
    entryFor: (entityId: string) => byEntityId.get(entityId),
    isInWishlist: (entityId: string) => byEntityId.has(entityId),
    add: (entityId: string) => addMutation.mutate(entityId),
    /** N'ajoute que ce qui n'y est pas déjà : rejouer le bouton ne crée pas de doublon. */
    addMany: (entityIds: string[]) =>
      addManyMutation.mutate(entityIds.filter((id) => !byEntityId.has(id))),
    remove: (entryId: string, entityId: string) => removeMutation.mutate({ entryId, entityId }),
    isPending: addMutation.isPending || removeMutation.isPending || addManyMutation.isPending,
  }
}
