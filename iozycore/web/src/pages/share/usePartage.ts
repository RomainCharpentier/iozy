import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  generateShare,
  getGiftPreview,
  getShare,
  getSharePreview,
  issueGiftLink,
  removeGiftLink,
  removeShare,
  setPinnedWorks,
  updateShare,
} from '@/common/api/share'
import { queryKeys } from '@/common/lib/queryKeys'
import type { ShareDto } from '@/common/types/share'

/** The address a visitor opens. The app may live under a prefix (/core/): the link carries it. */
export function adresseDuLien(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}public/share/${token}`
}

/**
 * The data and the actions of the "Partager" page (lot 217). Every write
 * returns the new state of the sharing, written to the cache at once; the
 * previews are read again so they never show the page as it was.
 */
export function usePartage() {
  const queryClient = useQueryClient()
  const partage = useQuery({ queryKey: queryKeys.share, queryFn: getShare })
  const apercu = useQuery({ queryKey: queryKeys.sharePreview, queryFn: getSharePreview })
  const aUneListe = !!partage.data?.giftLink
  const apercuCadeaux = useQuery({ queryKey: queryKeys.giftPreview, queryFn: getGiftPreview, enabled: aUneListe })

  function appliquer(data: ShareDto | undefined) {
    if (data) queryClient.setQueryData(queryKeys.share, data)
    void queryClient.invalidateQueries({ queryKey: queryKeys.sharePreview })
    void queryClient.invalidateQueries({ queryKey: queryKeys.giftPreview })
  }

  function sansLien(): ShareDto {
    return {
      ...(partage.data ?? { shareCollection: true, shareWishlist: true, includeTierLists: false }),
      token: null,
      shareCollection: true,
      shareWishlist: true,
      includeTierLists: false,
      showValue: false,
    }
  }

  const generer = useMutation({ mutationFn: generateShare, onSuccess: appliquer })
  const modifier = useMutation({ mutationFn: updateShare, onSuccess: appliquer })
  const desactiver = useMutation({ mutationFn: removeShare, onSuccess: () => appliquer(sansLien()) })
  const epingler = useMutation({ mutationFn: setPinnedWorks, onSuccess: appliquer })
  const creerListe = useMutation({ mutationFn: issueGiftLink, onSuccess: appliquer })
  const supprimerListe = useMutation({
    mutationFn: removeGiftLink,
    onSuccess: () => appliquer(partage.data ? { ...partage.data, giftLink: null } : undefined),
  })

  return { partage, apercu, apercuCadeaux, generer, modifier, desactiver, epingler, creerListe, supprimerListe }
}
