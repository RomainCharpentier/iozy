import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { followWork, listFollowedWorks, unfollowWork } from '@/common/api/followedWork'
import { useToast } from '@/common/lib/toast'
import { queryKeys } from '@/common/lib/queryKeys'
import { invaliderApresSuivi } from '@/common/lib/invalidations'

/**
 * SINGLE SOURCE of "what I follow" - the third state of a work, with
 * Owned and Wish, only one at a time. Following a work means waiting for its
 * releases: it, and it alone, enters the calendar.
 *
 * <p>Same pattern as the wishes (see useWishlist): a brief message with
 * "Annuler", and the cancel does EXACTLY the opposite action. The server
 * holds the exclusivity rule; here we only invalidate what it may have
 * changed - the wish removed by a follow, the calendar.
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
      // `silencieux` = this removal IS the cancellation of a follow: offering
      // "Annuler" again would loop between two messages.
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
    /** The action of the button: follow, or stop following, depending on the state. */
    basculer(entityId: string) {
      if (suivies.some((s) => s.entityId === entityId)) nePlusSuivre.mutate({ entityId })
      else suivre.mutate(entityId)
    },
  }
}
