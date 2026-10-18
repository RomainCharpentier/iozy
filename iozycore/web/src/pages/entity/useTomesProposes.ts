import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { searchVolumes } from '@/common/api/metadata'
import { queryKeys } from '@/common/lib/queryKeys'
import type { VolumeCandidateDto } from '@/common/types/api'
import { indicesDe } from '@/common/lib/indicesOeuvre'

/**
 * The volumes that a provider knows for this work, and that the catalog
 * does not have yet.
 *
 * <h2>Why the detail page needs it</h2>
 * Two screens need it: the preview of a work one does not own (see
 * ApercuOeuvrePage), and the detail page of a work that exists without any volume -
 * added to the wishes, for example. Without this search, both
 * would open empty, with manual entry as the only way out, while
 * this is exactly the moment when one wants to check "I have volumes 1 to 12".
 *
 * <p>It is the search that the old add screen did, moved to where
 * it is useful. Same endpoint, same cache: a work already looked at does not
 * restart anything.
 *
 * <h2>What it does not do</h2>
 * It only runs on demand (`actif`): a detail page whose volumes are
 * already cataloged has nothing to ask an external provider, and the Google Books
 * quota is a real resource (see `fournisseurMuet`).
 */
export function useTomesProposes({
  entityTypeId,
  titre,
  attributs,
  actif,
}: {
  entityTypeId: string
  titre: string
  attributs: Record<string, unknown>
  actif: boolean
}) {
  const indices = indicesDe(attributs)
  const queryClient = useQueryClient()
  const cle = queryKeys.tomesProposes(entityTypeId, titre, indices.author)
  const requete = useQuery({
    queryKey: cle,
    queryFn: () => searchVolumes(entityTypeId, titre, indices),
    enabled: actif && titre.trim() !== '',
    // An external provider that does not answer is not a failure of the
    // detail page: it stays usable, manual entry takes over.
    retry: false,
  })

  /**
   * "Actualiser depuis la source": the same search, asking the
   * server to ignore what it has in cache (`forceRefresh`). The durable
   * cache keeps a list of volumes forever - this is intended, it
   * spares the providers - but a list saved on a day when a
   * provider was silent, or by an older version of the
   * provider, stays incomplete until it is asked for again (Batch 121:
   * Boruto, 7 volumes in cache when the BnF knew 20). The result
   * replaces that of the normal request, without a second call.
   */
  const actualisation = useMutation({
    mutationFn: () => searchVolumes(entityTypeId, titre, { ...indices, forceRefresh: true }),
    onSuccess: (data) => queryClient.setQueryData(cle, data),
  })

  /**
   * "Chercher d'autres éditions": the deep search of the server
   * (`deepSearch`), which queries keywords of rare editions - integral,
   * collector, double edition... Costly (five requests to the provider),
   * so on demand and never on load. The server MERGES the
   * result with what it already knows: the answer replaces the whole
   * list, it is not added to it.
   */
  const approfondissement = useMutation({
    mutationFn: () => searchVolumes(entityTypeId, titre, { ...indices, deepSearch: true }),
    onSuccess: (data) => queryClient.setQueryData(cle, data),
  })

  return {
    candidats: (requete.data?.volumes ?? []) as VolumeCandidateDto[],
    fournisseurMuet: requete.data?.quotaExceeded ?? false,
    enCours: requete.isFetching || actualisation.isPending || approfondissement.isPending,
    aEchoue: requete.isError,
    relancer: requete.refetch,
    actualiser: () => actualisation.mutate(),
    actualisationEnCours: actualisation.isPending,
    chercherPlusEditions: () => approfondissement.mutate(),
    rechercheApprofondieEnCours: approfondissement.isPending,
  }
}
