import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMonthSpending, listToBuy, setBudget } from '@/common/api/purchases'
import { useJeLAi } from '@/common/hooks/useJeLAi'
import { queryKeys } from '@/common/lib/queryKeys'
import { useToast } from '@/common/lib/toast'

/**
 * The data of the "À acheter" page and its two gestures (lot 216): "Je l'ai"
 * (shared with the home page, see useJeLAi) and the monthly budget.
 */
export function useAcheter() {
  const queryClient = useQueryClient()
  const toast = useToast()
  // Read again on arrival, even when the home page has it: this is where one buys, and a
  // change made elsewhere (another device) must not wait for the cache to age.
  const liste = useQuery({ queryKey: queryKeys.purchases.toBuy, queryFn: listToBuy, refetchOnMount: 'always' })
  const mois = useQuery({ queryKey: queryKeys.purchases.month, queryFn: fetchMonthSpending, refetchOnMount: 'always' })
  const jeLAi = useJeLAi()

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
