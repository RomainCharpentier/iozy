import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToWishlist, listWishlist, removeFromWishlist, type WishlistTarget } from '@/common/api/wishlist'
import { useToast } from '@/common/lib/toast'
import { queryKeys } from '@/common/lib/queryKeys'
import { invaliderApresEnvie } from '@/common/lib/invalidations'

/**
 * SINGLE SOURCE of the "Envies" behavior.
 *
 * All the surfaces that display or change the wishes go through here:
 * the volume grid of a detail page, Ma collection filtered by Envies, the
 * search results, the scan menu, the purchase analysis and the badge of the
 * headers. They therefore share the same state, the same cache invalidation
 * and the same visual feedback - impossible to drift apart.
 *
 * Adding had only ONE caller in the whole application (the result of a
 * purchase analysis), while the Envies screen, its badge and its share link
 * all existed: see docs/USER_JOURNEYS.md, UX-2.
 *
 * **Real cancel, never decorative**: canceling an add deletes the entry that
 * was just created (its id comes from the POST response); canceling a
 * removal recreates the entry for the same work. Both really restore the
 * previous state, which is why "Annuler" is offered in both directions.
 *
 * **The wish applies to the really collectible object**: the VOLUME for a
 * manga, the WORK for a type that is owned as a single piece (see
 * lib/typeDeCollection). Hence the two indexes below, which must never be
 * confused - a series is not "wanted" because one of its volumes is, it is
 * only a group.
 *
 * **A work that is not owned can be put in the wishes**: it is even the
 * normal case. `add` accepts a work that already has a detail page as well as
 * a work coming from an external search or from a scan (see WishlistTarget);
 * the backend resolves or creates the matching catalog page, without ever
 * creating an ownership. Wanting something is not owning it.
 */
export function useWishlist() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: queryKeys.wishlist.all, queryFn: listWishlist })
  const entries = query.data ?? []

  function invalidate() {
    invaliderApresEnvie(queryClient)
  }

  /**
   * Adding an EXTERNAL work creates a catalog page for it: two caches
   * then become wrong and must start again from zero.
   * - the local search, which did not know this page yet and therefore did
   *   not display the work in "Déjà dans IozyCore";
   * - the metadata search, which discards titles that are already cataloged
   *   (see MetadataSearchService) and must therefore stop offering it.
   * Without this, the screen keeps displaying the state from before the add.
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
      toast(created.variantId ? 'Tome ajouté aux envies' : 'Ajouté aux envies', {
        label: 'Annuler',
        onAction: () => removeMutation.mutate({ entryId: created.id, cible: target, silencieux: true }),
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ entryId }: { entryId: string; cible: WishlistTarget; silencieux?: boolean }) =>
      removeFromWishlist(entryId),
    onSuccess: (_result, variables) => {
      invalidate()
      // `silencieux` = this removal IS the cancellation of an add: offering
      // "Annuler" again would make the user loop between two messages.
      if (variables.silencieux) return
      toast('Retiré des envies', {
        label: 'Annuler',
        // Adds back EXACTLY the same object - the volume, not the series.
        // Before, we added back by `entityId` alone: canceling the removal of
        // volume 7 put the entire series back in the wishes, which is no
        // longer the same thing since the wish applies to the collectible
        // object.
        onAction: () => addMutation.mutate(variables.cible),
      })
    },
  })

  /**
   * Grouped add (result of a purchase analysis: all the known volumes of the
   * batch). One single message for the whole, and a cancel that removes
   * exactly the entries created - before, this button added in bulk "without
   * confirmation, without a feedback message and without saying how many
   * were added" (docs/USER_JOURNEYS.md, UX-4).
   *
   * **A refusal does not interrupt the batch**: a volume that is already owned
   * is refused with a 409 (wanting and owning do not overlap), and it is a
   * normal case in a listing that overlaps with the collection. Interrupting
   * there would abandon all the following volumes, without saying anything.
   */
  const addManyMutation = useMutation({
    mutationFn: async (cibles: WishlistTarget[]) => {
      const nouveaux = []
      for (const cible of cibles) {
        try {
          nouveaux.push(await addToWishlist(cible))
        } catch {
          // Already owned, or already wanted: nothing to add, nothing to report.
        }
      }
      return nouveaux
    },
    onSuccess: (crees) => {
      invalidate()
      if (crees.length === 0) {
        toast('Rien à ajouter - tu as déjà tout ça, ou tu le voulais déjà')
        return
      }
      toast(crees.length === 1 ? 'Tome ajouté aux envies' : `${crees.length} tomes ajoutés aux envies`, {
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

  // Two indexes, because there are two kinds of wish: the one of a VOLUME (the
  // normal case for a manga) and the one of a whole WORK (types without volumes).
  // Confusing them would make a whole series say "already wanted" as soon as
  // only one of its volumes is.
  const parTome = new Map(
    entries.filter((entry) => entry.variantId).map((entry) => [entry.variantId as string, entry]),
  )
  const parOeuvre = new Map(entries.filter((entry) => !entry.variantId).map((entry) => [entry.entityId, entry]))

  return {
    /** Number of wishes - feeds the badge of the headers. */
    count: entries.length,
    entries,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    /** The entry that applies to the WHOLE work, or undefined. */
    entryFor: (entityId: string) => parOeuvre.get(entityId),
    isInWishlist: (entityId: string) => parOeuvre.has(entityId),
    /** The entry that applies to THIS volume, or undefined. */
    entryForVariant: (variantId: string) => parTome.get(variantId),
    /** The wanted volumes of a work - what the grid of the detail page colors. */
    variantsVoulus: new Set(parTome.keys()),
    add: (target: WishlistTarget) => addMutation.mutate(target),
    /**
     * Like `add`, but returns the created entry: the only way, for an
     * external work that did not have a detail page yet, to know its internal
     * identity - and therefore to be able to then display it as "in your
     * wishes" or remove it.
     */
    addAsync: (target: WishlistTarget) => addMutation.mutateAsync(target),
    /** Replaying the button does not create a duplicate: the backend is idempotent on
     *  the wanted object, and what is already owned is simply ignored. */
    addMany: (cibles: WishlistTarget[]) => addManyMutation.mutate(cibles),
    /** `cible` describes what was just removed, so that "Annuler" puts back
     *  the same object and not its group. */
    remove: (entryId: string, cible: WishlistTarget) => removeMutation.mutate({ entryId, cible }),
    isPending: addMutation.isPending || removeMutation.isPending || addManyMutation.isPending,
  }
}
