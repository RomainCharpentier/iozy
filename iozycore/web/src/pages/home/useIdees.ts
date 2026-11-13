import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRecommendations, type RecommendationsDto } from '@/common/api/home'
import { useAuth } from '@/common/hooks/useAuth'
import type { Idee } from './mur'

const CLE = 'iozycore.recommandations.v2'

/** The ideas kept for the day in this browser: asking again costs a model call and several searches. */
function duJour(): RecommendationsDto | undefined {
  try {
    const lu = JSON.parse(window.localStorage.getItem(CLE) ?? 'null') as { jour: string; donnees: RecommendationsDto } | null
    return lu && lu.jour === new Date().toDateString() && lu.donnees.items.length > 0 ? lu.donnees : undefined
  } catch {
    return undefined
  }
}

function garder(donnees: RecommendationsDto): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify({ jour: new Date().toDateString(), donnees }))
  } catch {
    // No storage (private window): the ideas are simply asked again next time.
  }
}

/**
 * The ideas "pour toi": works the account does not own and may like (a model
 * proposes them, a catalog source confirms each one). Slow the first time of
 * the day (30 to 45 s), then instant. The wall shows them as they arrive and
 * never waits for them; without a model there are simply none.
 */
export function useIdees() {
  const { estInvite } = useAuth()
  const idees = useQuery({
    queryKey: ['home', 'recommendations'],
    queryFn: async () => {
      const donnees = await fetchRecommendations()
      if (donnees.items.length > 0) garder(donnees)
      return donnees
    },
    initialData: duJour,
    staleTime: Infinity,
    retry: false,
    enabled: !estInvite,
  })
  // The same array while the data does not change: the wall is composed again only when it must.
  const items = idees.data?.items
  const liste = useMemo<Idee[]>(
    () => (items ?? []).map((i) => ({ title: i.title, imageUrl: i.imageUrl, entityTypeId: i.entityTypeId, why: i.why })),
    [items],
  )
  return { idees: liste, enCours: idees.isFetching }
}
