import { Eye } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'

/**
 * Ce qu'un visiteur doit lire en permanence : <b>chez qui</b> il est, et
 * <b>qu'il ne peut rien changer</b>.
 *
 * <h2>Permanent, et pas un message d'accueil</h2>
 * La tentation était d'annoncer la visite une fois, à l'entrée, puis de laisser
 * la place au contenu. Elle ne tient pas : ces écrans sont exactement ceux
 * d'une collection personnelle, et rien d'autre ne distingue « ma collection »
 * de « la sienne ». Quelqu'un qui arrive trois écrans plus loin, ou qui revient
 * sur un onglet laissé ouvert, n'aurait plus aucun moyen de savoir ce qu'il
 * regarde - ni pourquoi une fiche ne se modifie pas.
 *
 * <h2>La sortie est ICI</h2>
 * Un visiteur n'a ni profil ni réglages où aller la chercher (voir
 * lib/accesInvite) : sans ce bouton, sortir demanderait de vider un cookie. Il
 * dit « Quitter » et non « Se déconnecter » - il n'y a pas de compte à quitter,
 * seulement une collection.
 */
export function BandeauVisite() {
  const { estInvite, compte, deconnexion } = useAuth()
  if (!estInvite) return null

  return (
    <div className="border-b border-line bg-surface2">
      <div className="mx-auto flex w-[min(100%-2rem,1600px)] flex-wrap items-center gap-x-3 gap-y-1.5 py-2 md:w-[min(100%-3rem,1600px)]">
        <Eye size={16} className="shrink-0 text-textDim" aria-hidden="true" />
        <p className="min-w-0 text-sm text-textDim">
          Tu visites la collection de{' '}
          <span className="font-semibold text-textPrimary">{compte?.pseudo}</span> — lecture seule.
        </p>
        <button
          type="button"
          onClick={() => deconnexion.mutate()}
          disabled={deconnexion.isPending}
          className="ml-auto min-h-9 shrink-0 rounded-lg bg-surface px-3 text-sm font-medium text-textPrimary disabled:opacity-50"
        >
          Quitter
        </button>
      </div>
    </div>
  )
}
