import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { followWork, listFollowedWorks, unfollowWork } from '@/common/api/followedWork'
import { useToast } from '@/common/lib/toast'
import { queryKeys } from '@/common/lib/queryKeys'
import { invaliderApresSuivi } from '@/common/lib/invalidations'

/**
 * SOURCE UNIQUE de « ce que je suis » - le troisième état d'une œuvre, avec
 * Possédé et Envie, un seul à la fois. Suivre une œuvre, c'est en attendre
 * les sorties : c'est elle, et elle seule, qui entre au calendrier.
 *
 * <p>Même patron que les envies (voir useWishlist) : un message bref avec
 * « Annuler », et l'annulation refait EXACTEMENT le geste inverse. Le serveur
 * tient la règle d'exclusivité ; ici on ne fait qu'invalider ce qu'elle a pu
 * changer - l'envie retirée par un suivi, le calendrier.
 */
export function useOeuvresSuivies() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({ queryKey: queryKeys.followedWorks.all, queryFn: listFollowedWorks })
  const suivies = query.data ?? []

  const suivre = useMutation({
    mutationFn: (entityId: string) => followWork(entityId),
    onSuccess: (_suivie, entityId) => {
      invaliderApresSuivi(queryClient)
      toast('Œuvre suivie : ses sorties arrivent au calendrier', {
        label: 'Annuler',
        onAction: () => nePlusSuivre.mutate({ entityId, silencieux: true }),
      })
    },
  })

  const nePlusSuivre = useMutation({
    mutationFn: ({ entityId }: { entityId: string; silencieux?: boolean }) => unfollowWork(entityId),
    onSuccess: (_rien, variables) => {
      invaliderApresSuivi(queryClient)
      // `silencieux` = ce retrait EST l'annulation d'un suivi : reproposer
      // « Annuler » ferait boucler entre deux messages.
      if (variables.silencieux) return
      toast('Œuvre plus suivie', { label: 'Annuler', onAction: () => suivre.mutate(variables.entityId) })
    },
  })

  return {
    suivies,
    isLoading: query.isLoading,
    isPending: suivre.isPending || nePlusSuivre.isPending,
    estSuivie: (entityId: string) => suivies.some((s) => s.entityId === entityId),
    suivre: (entityId: string) => suivre.mutate(entityId),
    nePlusSuivre: (entityId: string) => nePlusSuivre.mutate({ entityId }),
    /** Le geste du bouton : suivre, ou cesser de suivre, selon l'état. */
    basculer(entityId: string) {
      if (suivies.some((s) => s.entityId === entityId)) nePlusSuivre.mutate({ entityId })
      else suivre.mutate(entityId)
    },
  }
}
