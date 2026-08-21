import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToWishlist, listWishlist, removeFromWishlist, type WishlistTarget } from '../api/wishlist'
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
 * **Une œuvre non possédée peut être mise en envies** : c'est même le cas
 * normal. `add` accepte aussi bien une œuvre déjà fichée qu'une œuvre venue
 * d'une recherche externe ou d'un scan (voir WishlistTarget) ; le backend
 * résout ou crée la fiche catalogue correspondante, sans jamais créer de
 * possession. Vouloir quelque chose n'est pas le posséder.
 */
export function useWishlist() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: queryKeys.wishlist.all, queryFn: listWishlist })
  const entries = query.data ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
  }

  /**
   * Ajouter une œuvre EXTERNE lui crée une fiche catalogue : deux caches
   * deviennent alors faux et doivent repartir de zéro.
   * - la recherche locale, qui ne connaissait pas encore cette fiche et
   *   n'affichait donc pas l'œuvre dans « Déjà dans IozyCore » ;
   * - la recherche de métadonnées, qui écarte les titres déjà catalogués
   *   (voir MetadataSearchService) et doit donc cesser de la proposer.
   * Sans ça, l'écran continue d'afficher l'état d'avant l'ajout.
   */
  function invalidateApresCreationDeFiche() {
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    queryClient.invalidateQueries({ queryKey: ['metadata'] })
  }

  const addMutation = useMutation({
    mutationFn: (target: WishlistTarget) => addToWishlist(target),
    onSuccess: (created, target) => {
      invalidate()
      if (!('entityId' in target)) invalidateApresCreationDeFiche()
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
        // L'œuvre a forcément une fiche à ce stade (elle en avait une pour
        // être en envies), donc on réajoute par identité interne.
        onAction: () => addMutation.mutate({ entityId: variables.entityId }),
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
        nouveaux.push(await addToWishlist({ entityId }))
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
    add: (target: WishlistTarget) => addMutation.mutate(target),
    /**
     * Comme `add`, mais rend l'entrée créée : la seule façon, pour une œuvre
     * externe qui n'avait pas encore de fiche, de connaître son identité
     * interne - et donc de pouvoir ensuite l'afficher comme « dans vos
     * envies » ou la retirer.
     */
    addAsync: (target: WishlistTarget) => addMutation.mutateAsync(target),
    /** N'ajoute que ce qui n'y est pas déjà : rejouer le bouton ne crée pas de doublon. */
    addMany: (entityIds: string[]) =>
      addManyMutation.mutate(entityIds.filter((id) => !byEntityId.has(id))),
    remove: (entryId: string, entityId: string) => removeMutation.mutate({ entryId, entityId }),
    isPending: addMutation.isPending || removeMutation.isPending || addManyMutation.isPending,
  }
}
