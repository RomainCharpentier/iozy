import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Copy, RefreshCw, X } from 'lucide-react'
import { generateShare, getShare, removeShare, updateShare } from '../../api/share'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import type { ShareDto } from '../../types/share'

/**
 * Le partage d'espace : **un lien, des sections au choix**.
 *
 * Il y avait deux sections de réglages indépendantes - « Partager ma
 * collection » sous Profil, « Partager ma wishlist » sous Envies - chacune
 * avec son propre lien. Entrer par l'une ou par l'autre donnait deux URL
 * différentes pour le même espace personnel, et la personne qui les recevait
 * devait jongler entre deux pages.
 *
 * Ce composant est désormais le seul, monté à l'identique depuis Profil et
 * depuis Envies : les deux pilotent le **même** partage et le **même** jeton.
 * Ma collection et mes envies sont deux vues du même espace : elles se
 * partagent ensemble ou séparément, mais par le même lien.
 *
 * <p>`miseEnAvant` a disparu avec l'écran Envies (lot C) : il ordonnait les
 * deux cases selon l'écran d'où l'on venait, et il n'y a plus qu'un écran
 * d'où venir.
 *
 */
export function ShareSection() {
  const queryClient = useQueryClient()
  const [copie, setCopie] = useState(false)

  const shareQuery = useQuery({ queryKey: queryKeys.share, queryFn: getShare })

  const share = shareQuery.data
  const token = share?.token ?? null
  const url = token ? `${window.location.origin}/public/share/${token}` : null

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
      // Certains navigateurs refusent le presse-papier hors contexte sécurisé -
      // le lien reste affiché et sélectionnable, on n'annonce pas une copie
      // qui n'a pas eu lieu.
    }
  }

  // Décocher la dernière section active est refusé côté domaine : plutôt que
  // de laisser l'utilisateur se heurter à une erreur, la case correspondante
  // est désactivée et la raison affichée.
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
            className="flex min-h-11 w-fit items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk disabled:opacity-50"
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

            {/* Les classements accompagnent la collection : sans elle, ils ne
                sortent pas - la case suit donc son parent. Un classement est un
                jugement personnel, pas un inventaire : il reste exclu par
                défaut, y compris sur un lien tout neuf. */}
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
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk"
            >
              <Copy size={14} />
              {copie ? 'Lien copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              title="L'ancien lien cessera de fonctionner."
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-surface2 px-3 text-sm font-medium text-textPrimary disabled:opacity-50"
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
