import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { searchVolumes } from '../api/metadata'
import { queryKeys } from './queryKeys'
import type { VolumeCandidateDto } from '../types/api'
import { indicesDe } from './indicesOeuvre'

/**
 * Les tomes qu'un fournisseur connaît pour cette œuvre, et que le catalogue
 * n'a pas encore.
 *
 * <h2>Pourquoi la fiche en a besoin</h2>
 * Deux écrans en ont besoin : l'aperçu d'une œuvre qu'on ne possède pas (voir
 * ApercuOeuvrePage), et la fiche d'une œuvre qui existe sans le moindre tome -
 * ajoutée en envies, par exemple. Sans cette recherche, l'un comme l'autre
 * s'ouvriraient vides, avec pour seule issue une saisie manuelle, alors que
 * c'est exactement le moment où l'on veut cocher « j'ai les tomes 1 à 12 ».
 *
 * <p>C'est la recherche que faisait l'ancien écran d'ajout, déplacée là où
 * elle sert. Même endpoint, même cache : une œuvre déjà consultée ne relance
 * rien.
 *
 * <h2>Ce qu'elle ne fait pas</h2>
 * Elle ne s'exécute que sur demande (`actif`) : une fiche dont les tomes sont
 * déjà catalogués n'a rien à demander à un fournisseur externe, et le quota
 * Google Books est une ressource réelle (voir `fournisseurMuet`).
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
  const cle = queryKeys.tomesProposes(entityTypeId, titre)
  const requete = useQuery({
    queryKey: cle,
    queryFn: () => searchVolumes(entityTypeId, titre, indices),
    enabled: actif && titre.trim() !== '',
    // Un fournisseur externe qui ne répond pas n'est pas une panne de la
    // fiche : elle reste utilisable, la saisie manuelle prend le relais.
    retry: false,
  })

  /**
   * « Actualiser depuis la source » : la même recherche, en demandant au
   * serveur d'ignorer ce qu'il a en cache (`forceRefresh`). Le cache
   * durable garde une liste de tomes pour toujours - c'est voulu, il
   * épargne les fournisseurs - mais une liste enregistrée un jour où un
   * fournisseur se taisait, ou par une version plus ancienne du
   * fournisseur, reste incomplète jusqu'à ce qu'on la redemande (Lot 121 :
   * Boruto, 7 tomes en cache quand la BnF en connaissait 20). Le résultat
   * remplace celui de la requête normale, sans second appel.
   */
  const actualisation = useMutation({
    mutationFn: () => searchVolumes(entityTypeId, titre, { ...indices, forceRefresh: true }),
    onSuccess: (data) => queryClient.setQueryData(cle, data),
  })

  return {
    candidats: (requete.data?.volumes ?? []) as VolumeCandidateDto[],
    fournisseurMuet: requete.data?.quotaExceeded ?? false,
    enCours: requete.isFetching || actualisation.isPending,
    aEchoue: requete.isError,
    relancer: requete.refetch,
    actualiser: () => actualisation.mutate(),
    actualisationEnCours: actualisation.isPending,
  }
}
