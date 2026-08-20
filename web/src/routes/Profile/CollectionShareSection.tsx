import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, RefreshCw, X } from 'lucide-react'
import {
  generateCollectionShare,
  getCollectionShare,
  removeCollectionShare,
  setCollectionShareTierLists,
} from '../../api/collectionShare'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * "Partager ma collection" (voir la maquette V1.2, Profil) - un lien secret
 * (jeton imprévisible) qu'on peut ouvrir sans compte ni app, plus
 * l'interrupteur "partager aussi mes Tier Lists".
 * <p>
 * Lien DISTINCT de celui de la wishlist (voir WishlistShareSection) : les
 * deux s'activent et se révoquent séparément - partager ce qu'on cherche et
 * partager ce qu'on possède sont deux décisions différentes.
 * <p>
 * Dit toujours ce que le lien expose AVANT de le générer, et ce qu'il
 * n'expose jamais : sans ça, "partager ma collection" est une promesse floue
 * sur des données personnelles (voir PublicCollectionController pour la
 * liste exacte).
 */
export function CollectionShareSection() {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const shareQuery = useQuery({ queryKey: queryKeys.collectionShare, queryFn: getCollectionShare })

  const generateMutation = useMutation({
    mutationFn: generateCollectionShare,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.collectionShare, data)
      setCopied(false)
    },
  })
  const removeMutation = useMutation({
    mutationFn: removeCollectionShare,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.collectionShare, { token: null, includeTierLists: false })
      setCopied(false)
    },
  })
  const tierListsMutation = useMutation({
    mutationFn: setCollectionShareTierLists,
    onSuccess: (data) => queryClient.setQueryData(queryKeys.collectionShare, data),
  })

  const share = shareQuery.data
  const token = share?.token ?? null
  const shareUrl = token ? `${window.location.origin}/public/collection/${token}` : null

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
        Partager ma collection
      </p>

      {shareQuery.isError && <ErrorBanner message={shareQuery.error.message} />}
      {generateMutation.isError && <ErrorBanner message={generateMutation.error.message} />}
      {tierListsMutation.isError && <ErrorBanner message={tierListsMutation.error.message} />}

      {shareUrl ? (
        <>
          <p className="break-all rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textDim">{shareUrl}</p>

          {/* L'interrupteur ne touche jamais au jeton : un lien déjà envoyé
              reste valable, seul son contenu change. */}
          <label className="flex cursor-pointer items-center gap-2.5 py-1">
            <input
              type="checkbox"
              checked={share?.includeTierLists ?? false}
              disabled={tierListsMutation.isPending}
              onChange={(e) => tierListsMutation.mutate(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-xs text-textPrimary">
              Partager aussi mes Tier Lists
              <span className="block text-textDim">Tes classements sont des avis perso — désactivé par défaut.</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
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
          <p className="text-xs text-textDim">
            Régénérer remplace le lien : l'ancien cesse aussitôt de fonctionner, et le partage des Tier Lists repart
            désactivé.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-textDim">
            Un lien à envoyer pour montrer ce que tu possèdes : titre, jaquette, édition et progression (X/Y tomes).
            Jamais tes prix d'achat, ta valeur estimée, ni ta liste d'envies — elle a son propre lien. Révocable à tout
            moment.
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
