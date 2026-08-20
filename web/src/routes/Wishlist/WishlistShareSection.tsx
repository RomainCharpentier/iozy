import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Copy, RefreshCw, X } from 'lucide-react'
import { generateShareLink, getShareLink, removeShareLink } from '../../api/wishlist'
import { queryKeys } from '../../lib/queryKeys'

/** "Liste d'envies partageable" - un lien secret (jeton imprévisible) que
 * quelqu'un peut ouvrir sans avoir l'app ni de compte, pour voir ce que tu
 * recherches (offrir un cadeau sans créer de doublon). Volontairement PAS
 * un partage "toujours actif" par défaut : généré à la demande, révocable/
 * régénérable à tout moment (voir PublicWishlistController et
 * WishlistShareSettings côté backend pour le raisonnement de sécurité). */
export function WishlistShareSection() {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const shareLinkQuery = useQuery({ queryKey: queryKeys.wishlist.shareLink, queryFn: getShareLink })

  const generateMutation = useMutation({
    mutationFn: generateShareLink,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.wishlist.shareLink, data)
      setCopied(false)
    },
  })
  const removeMutation = useMutation({
    mutationFn: removeShareLink,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.wishlist.shareLink, { token: null })
      setCopied(false)
    },
  })

  const token = shareLinkQuery.data?.token ?? null
  const shareUrl = token ? `${window.location.origin}/public/wishlist/${token}` : null

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-textPrimary">
        <Link2 size={16} className="shrink-0 text-textDim" />
        Partager ma wishlist
      </p>

      {shareUrl ? (
        <>
          <p className="break-all rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textDim">{shareUrl}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk"
            >
              <Copy size={13} />
              {copied ? 'Copié !' : 'Copier le lien'}
            </button>
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Régénérer
            </button>
            <button
              type="button"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-textDim disabled:opacity-50"
            >
              <X size={13} />
              Supprimer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-textDim">
            Génère un lien à envoyer pour que quelqu'un voie ce que tu recherches, sans créer de doublon pour un
            cadeau. Révocable à tout moment.
          </p>
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-fit rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
          >
            Générer un lien
          </button>
        </>
      )}
    </section>
  )
}
