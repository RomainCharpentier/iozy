import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Copy, RefreshCw, X } from 'lucide-react'
import { generateShare, getShare, removeShare, updateShare } from '@/common/api/share'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import type { ShareDto } from '@/common/types/share'

/**
 * The space sharing: **one link, sections of your choice**.
 *
 * There were two independent settings sections - "Partager ma
 * collection" under Profil, "Partager ma wishlist" under Envies - each
 * with its own link. Entering by one or the other gave two different
 * URLs for the same personal space, and the person who received them
 * had to juggle between two pages.
 *
 * This component is now the only one, mounted identically from Profil and
 * from Envies: both drive the **same** sharing and the **same** token.
 * My collection and my wishes are two views of the same space: they are
 * shared together or separately, but through the same link.
 *
 * <p>`miseEnAvant` disappeared with the Envies screen (batch C): it ordered the
 * two checkboxes according to the screen one came from, and there is now only one screen
 * to come from.
 *
 */
export function ShareSection() {
  const queryClient = useQueryClient()
  const [copie, setCopie] = useState(false)

  const shareQuery = useQuery({ queryKey: queryKeys.share, queryFn: getShare })

  const share = shareQuery.data
  const token = share?.token ?? null
  // The app may live under a prefix (/core/ next to the family): the link
  // carries it, or the recipient would land on the home of the family.
  const url = token ? `${window.location.origin}${import.meta.env.BASE_URL}public/share/${token}` : null

  function appliquer(data: ShareDto) {
    queryClient.setQueryData(queryKeys.share, data)
    setCopie(false)
  }

  const generateMutation = useMutation({ mutationFn: generateShare, onSuccess: appliquer })
  const updateMutation = useMutation({ mutationFn: updateShare, onSuccess: appliquer })
  const removeMutation = useMutation({
    mutationFn: removeShare,
    onSuccess: () =>
      appliquer({ token: null, shareCollection: true, shareWishlist: true, includeTierLists: false }),
  })


  async function copierLeLien() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      // Some browsers refuse the clipboard outside a secure context -
      // the link stays displayed and selectable, we do not announce a copy
      // that did not take place.
    }
  }

  // Unchecking the last active section is refused on the domain side: rather than
  // letting the user run into an error, the matching checkbox
  // is disabled and the reason displayed.
  const derniereSectionActive = (section: 'collection' | 'wishlist') =>
    section === 'collection'
      ? !!share?.shareCollection && !share?.shareWishlist
      : !!share?.shareWishlist && !share?.shareCollection

  const sections = [
    {
      cle: 'collection' as const,
      titre: 'Ma collection',
      sousTitre: 'Les œuvres que tu possèdes',
      actif: !!share?.shareCollection,
      basculer: (valeur: boolean) => updateMutation.mutate({ shareCollection: valeur }),
    },
    {
      cle: 'wishlist' as const,
      titre: 'Mes envies',
      sousTitre: 'Les œuvres que tu souhaites obtenir',
      actif: !!share?.shareWishlist,
      basculer: (valeur: boolean) => updateMutation.mutate({ shareWishlist: valeur }),
    },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-textPrimary">
        <Link2 size={16} className="shrink-0 text-textDim" />
        Partage
      </p>

      {shareQuery.isError && <ErrorBanner message={shareQuery.error.message} />}

      {!token ? (
        <>
          <p className="text-xs text-textDim">
            Génère un lien à envoyer pour montrer ta collection, tes envies, ou les deux. Personne n'a besoin d'un
            compte pour l'ouvrir, et tu peux le désactiver à tout moment.
          </p>
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primaire w-fit"
          >
            {generateMutation.isPending ? 'Génération...' : 'Générer un lien'}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-textDim">Choisis ce qui est visible avec ton lien.</p>

          <div className="flex flex-col gap-1">
            {sections.map((section) => {
              const derniere = derniereSectionActive(section.cle)
              return (
                <label
                  key={section.cle}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 ${
                    derniere ? '' : 'cursor-pointer hover:bg-rowHover'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={section.actif}
                    disabled={derniere || updateMutation.isPending}
                    onChange={(e) => section.basculer(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-accent"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-textPrimary">{section.titre}</span>
                    <span className="text-xs text-textDim">
                      {derniere ? 'Au moins une section doit rester visible' : section.sousTitre}
                    </span>
                  </span>
                </label>
              )
            })}

            {/* The rankings go with the collection: without it, they do not
                come out - the checkbox therefore follows its parent. A ranking is
                a personal judgment, not an inventory: it stays excluded by
                default, including on a brand new link. */}
            {share?.shareCollection && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 pl-8 hover:bg-rowHover">
                <input
                  type="checkbox"
                  checked={share.includeTierLists}
                  disabled={updateMutation.isPending}
                  onChange={(e) => updateMutation.mutate({ includeTierLists: e.target.checked })}
                  className="h-5 w-5 shrink-0 accent-accent"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-textPrimary">Mes Tier Lists</span>
                  <span className="text-xs text-textDim">Tes classements, avec la collection</span>
                </span>
              </label>
            )}
          </div>

          {updateMutation.isError && <ErrorBanner message={updateMutation.error.message} />}

          <div className="flex flex-col gap-2">
            <span className="text-xs text-textDim">Lien de partage</span>
            <p className="break-all rounded-lg bg-surface2 px-2.5 py-2 text-xs text-textDim">{url}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copierLeLien}
              className="btn-primaire"
            >
              <Copy size={14} />
              {copie ? 'Lien copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              title="L'ancien lien cessera de fonctionner."
              className="btn-secondaire"
            >
              <RefreshCw size={14} />
              Régénérer
            </button>
            <button
              type="button"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-textDim disabled:opacity-50"
            >
              <X size={14} />
              Désactiver le partage
            </button>
          </div>
          <p className="text-xs text-textDim">
            Régénérer crée un nouveau lien : l'ancien cessera de fonctionner.
          </p>
        </>
      )}

    </section>
  )
}
