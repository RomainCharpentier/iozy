import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToWishlist, listWishlist, removeFromWishlist, type WishlistTarget } from '../api/wishlist'
import { useToast } from './toast'
import { queryKeys } from './queryKeys'
import { invaliderApresEnvie } from './invalidations'

/**
 * SOURCE UNIQUE du comportement « Envies ».
 *
 * Toutes les surfaces qui affichent ou modifient les envies passent par ici :
 * la grille de tomes d'une fiche, Ma collection filtrée par Envies, les
 * résultats de recherche, le menu du scan, l'analyse d'achat et le badge des
 * en-têtes. Elles partagent donc le même état, la même invalidation de cache
 * et le même retour visuel - impossible de dériver.
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
 * **L'envie porte sur l'objet réellement collectionnable** : le TOME pour un
 * manga, l'ŒUVRE pour un type qui se possède d'une seule pièce (voir
 * lib/typeDeCollection). D'où les deux index ci-dessous, qu'il ne faut surtout
 * pas confondre - une série n'est pas « voulue » parce qu'un de ses tomes
 * l'est, elle n'est qu'un groupe.
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
    invaliderApresEnvie(queryClient)
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
      // `silencieux` = ce retrait EST l'annulation d'un ajout : reproposer
      // « Annuler » ferait boucler l'utilisateur entre deux messages.
      if (variables.silencieux) return
      toast('Retiré des envies', {
        label: 'Annuler',
        // Réajoute EXACTEMENT le même objet - le tome, pas la série. Avant, on
        // réajoutait par `entityId` seul : annuler le retrait du tome 7
        // remettait en envies la série entière, ce qui n'est plus la même
        // chose depuis que l'envie porte sur l'objet collectionnable.
        onAction: () => addMutation.mutate(variables.cible),
      })
    },
  })

  /**
   * Ajout groupé (résultat d'une analyse d'achat : tous les tomes connus du
   * lot). Un seul message pour l'ensemble, et une annulation qui retire
   * exactement les entrées créées - avant, ce bouton ajoutait en masse « sans
   * confirmation, sans message de retour et sans indiquer combien ont été
   * ajoutées » (docs/USER_JOURNEYS.md, UX-4).
   *
   * **Un refus n'interrompt pas le lot** : un tome déjà possédé est refusé en
   * 409 (vouloir et avoir ne se superposent pas), et c'est un cas normal dans
   * une annonce qui recoupe la collection. Interrompre là abandonnerait tous
   * les tomes suivants, sans rien dire.
   */
  const addManyMutation = useMutation({
    mutationFn: async (cibles: WishlistTarget[]) => {
      const nouveaux = []
      for (const cible of cibles) {
        try {
          nouveaux.push(await addToWishlist(cible))
        } catch {
          // Déjà possédé, ou déjà voulu : rien à ajouter, rien à signaler.
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

  // Deux index, parce qu'il y a deux natures d'envie : celle d'un TOME (le cas
  // normal pour un manga) et celle d'une ŒUVRE entière (types sans tome).
  // Les confondre ferait dire « déjà voulu » à toute une série dès qu'un seul
  // de ses tomes l'est.
  const parTome = new Map(
    entries.filter((entry) => entry.variantId).map((entry) => [entry.variantId as string, entry]),
  )
  const parOeuvre = new Map(entries.filter((entry) => !entry.variantId).map((entry) => [entry.entityId, entry]))

  return {
    /** Nombre d'envies - alimente le badge des en-têtes. */
    count: entries.length,
    entries,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    /** L'entrée portant sur l'ŒUVRE entière, ou undefined. */
    entryFor: (entityId: string) => parOeuvre.get(entityId),
    isInWishlist: (entityId: string) => parOeuvre.has(entityId),
    /** L'entrée portant sur CE tome, ou undefined. */
    entryForVariant: (variantId: string) => parTome.get(variantId),
    /** Les tomes voulus d'une œuvre - ce que la grille de la fiche colorie. */
    variantsVoulus: new Set(parTome.keys()),
    add: (target: WishlistTarget) => addMutation.mutate(target),
    /**
     * Comme `add`, mais rend l'entrée créée : la seule façon, pour une œuvre
     * externe qui n'avait pas encore de fiche, de connaître son identité
     * interne - et donc de pouvoir ensuite l'afficher comme « dans vos
     * envies » ou la retirer.
     */
    addAsync: (target: WishlistTarget) => addMutation.mutateAsync(target),
    /** Rejouer le bouton ne crée pas de doublon : le backend est idempotent sur
     *  l'objet voulu, et ce qui est déjà possédé est simplement ignoré. */
    addMany: (cibles: WishlistTarget[]) => addManyMutation.mutate(cibles),
    /** `cible` décrit ce qui vient d'être retiré, pour qu'« Annuler » remette
     *  le même objet et pas son groupe. */
    remove: (entryId: string, cible: WishlistTarget) => removeMutation.mutate({ entryId, cible }),
    isPending: addMutation.isPending || removeMutation.isPending || addManyMutation.isPending,
  }
}
