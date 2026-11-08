import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acquireElement, fetchMonthSpending, listToBuy, setBudget } from '@/common/api/purchases'
import { deleteOwnership } from '@/common/api/ownerships'
import { addToWishlist } from '@/common/api/wishlist'
import { queryKeys } from '@/common/lib/queryKeys'
import { invaliderApresEnvie, invaliderApresPossession } from '@/common/lib/invalidations'
import { useToast } from '@/common/lib/toast'
import type { ToBuyLineDto } from '@/common/types/api'
import { titreLigne } from './libelles'

/** The key of a line: a work brings one grouped line, and one per release ahead. */
export function cleLigne(ligne: ToBuyLineDto): string {
  return `${ligne.entityId}:${ligne.kind}:${ligne.elements[0]?.key ?? ''}`
}

/** The list once "Je l'ai" took the first element of one line: the rest of the line stays. */
export function sansPremierElement(lignes: ToBuyLineDto[], cible: ToBuyLineDto): ToBuyLineDto[] {
  const cle = cleLigne(cible)
  return lignes.flatMap((ligne) => {
    if (cleLigne(ligne) !== cle) return [ligne]
    const reste = ligne.elements.slice(1)
    return reste.length === 0 ? [] : [{ ...ligne, elements: reste }]
  })
}

/**
 * The data of the "À acheter" page and its two gestures (lot 216).
 *
 * <h2>"Je l'ai" answers at once</h2>
 * The line loses its first element before the server answers (an optimistic
 * update): a purchase noted from the shop should not wait for the network.
 * A refusal puts the list back as it was and says why. The message that
 * follows offers "Annuler" for a few seconds (the toast), and undoing is
 * real: the copy is deleted, and the wish it closed comes back.
 */
export function useAcheter() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const liste = useQuery({ queryKey: queryKeys.purchases.toBuy, queryFn: listToBuy })
  const mois = useQuery({ queryKey: queryKeys.purchases.month, queryFn: fetchMonthSpending })

  const jeLAi = useMutation({
    mutationFn: (ligne: ToBuyLineDto) => acquireElement(ligne.entityId, ligne.elements[0].key),
    onMutate: async (ligne) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.purchases.toBuy })
      const avant = queryClient.getQueryData<ToBuyLineDto[]>(queryKeys.purchases.toBuy)
      if (avant) queryClient.setQueryData(queryKeys.purchases.toBuy, sansPremierElement(avant, ligne))
      return { avant }
    },
    onError: (error, _ligne, contexte) => {
      if (contexte?.avant) queryClient.setQueryData(queryKeys.purchases.toBuy, contexte.avant)
      toast(`Impossible de l'ajouter : ${error.message}`)
    },
    onSuccess: (acquis, ligne) => {
      const element = ligne.elements[0]
      const nom = element.key === 'work' ? ligne.title : titreLigne({ ...ligne, elements: [element] })
      toast(`${nom} : dans ta collection`, {
        label: 'Annuler',
        onAction: () => {
          void (async () => {
            try {
              await deleteOwnership(acquis.ownershipId)
              if (acquis.wishRemoved) {
                await addToWishlist(
                  acquis.variantId
                    ? { entityId: acquis.entityId, variantId: acquis.variantId }
                    : { entityId: acquis.entityId },
                )
              }
            } catch (error) {
              toast(`Impossible d'annuler : ${(error as Error).message}`)
            } finally {
              invaliderApresPossession(queryClient)
              invaliderApresEnvie(queryClient)
            }
          })()
        },
      })
    },
    onSettled: () => invaliderApresPossession(queryClient),
  })

  const budget = useMutation({
    mutationFn: (montant: number | null) => setBudget(montant),
    onSuccess: (_resultat, montant) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.month })
      toast(montant === null ? 'Budget retiré' : 'Budget enregistré')
    },
    onError: (error) => toast(`Impossible d'enregistrer le budget : ${error.message}`),
  })

  return { liste, mois, jeLAi, budget }
}
