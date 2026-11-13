import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMonthSpending, listToBuy } from '@/common/api/purchases'
import { fetchCollectionSummary, listWorks } from '@/common/api/works'
import { useNow } from '@/common/hooks/useNow'
import { queryKeys } from '@/common/lib/queryKeys'
import { composerMur } from './mur'
import { useIdees } from './useIdees'

/**
 * The data of the wall (lot 219): the works, what there is to buy, the month
 * spent and the ideas. The wall waits for the first two only; the month and
 * the ideas join it when they arrive, and the ideas keep their places with
 * waiting tiles in the meantime.
 */
export function useMur() {
  const now = useNow()
  const oeuvres = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks })
  const aAcheter = useQuery({ queryKey: queryKeys.purchases.toBuy, queryFn: listToBuy })
  const mois = useQuery({ queryKey: queryKeys.purchases.month, queryFn: fetchMonthSpending })
  const resume = useQuery({ queryKey: queryKeys.works.summary, queryFn: fetchCollectionSummary })
  const { idees, enCours } = useIdees()

  const mur = useMemo(
    () =>
      composerMur({
        oeuvres: oeuvres.data ?? [],
        aAcheter: aAcheter.data ?? [],
        idees,
        ideesEnCours: enCours,
        mois: mois.data ?? null,
        now,
      }),
    [oeuvres.data, aAcheter.data, idees, enCours, mois.data, now],
  )

  const erreur = oeuvres.error ?? aAcheter.error
  return {
    mur,
    totalObjets: resume.data?.totalObjects ?? null,
    chargement: oeuvres.isPending || aAcheter.isPending,
    erreur,
    reessayer: () => {
      void oeuvres.refetch()
      void aAcheter.refetch()
    },
    reessaiEnCours: oeuvres.isFetching || aAcheter.isFetching,
  }
}
