import { useQuery } from '@tanstack/react-query'
import { fetchHomeWeek } from '@/common/api/home'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EntityTypeDto } from '@/common/types/api'

/**
 * The data of the home page: the week (one call, composed by the server) and
 * the types, which name a shelf and give its covers their shape. A type the
 * list does not know yet still gets a shelf, with a neutral name.
 */
export function useSemaine() {
  const semaine = useQuery({ queryKey: queryKeys.works.home, queryFn: fetchHomeWeek })
  const types = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const typesParId = new Map<string, EntityTypeDto>((types.data ?? []).map((t) => [t.id, t]))
  return {
    semaine: semaine.data ?? null,
    typesParId,
    chargement: semaine.isPending,
    erreur: semaine.error,
    reessayer: () => void semaine.refetch(),
    reessaiEnCours: semaine.isFetching,
  }
}
