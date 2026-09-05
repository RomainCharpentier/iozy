import { Eye } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * Ce qu'un visiteur doit lire en permanence : <b>ce qu'il regarde</b>, et
 * <b>qu'il ne peut rien changer</b>.
 *
 * <h2>Permanent, et pas un message d'accueil</h2>
 * La tentation était d'annoncer la visite une fois, à l'entrée, puis de laisser
 * la place au contenu. Elle ne tient pas : ces écrans sont exactement ceux
 * d'une collection personnelle, et rien ne distingue à l'œil « le catalogue »
 * d'« une collection vide ». Quelqu'un qui arrive trois écrans plus loin, ou
 * qui revient sur un onglet laissé ouvert, n'aurait plus aucun moyen de savoir
 * ce qu'il regarde - ni pourquoi une fiche ne se modifie pas.
 *
 * <h2>Il informe, il n'agit pas</h2>
 * La sortie a vécu ici, puis elle est remontée dans l'en-tête : il n'y a plus
 * qu'UN bouton pour sortir, au même endroit pour un compte et pour un
 * visiteur (voir {@code BoutonSortie}). Ce bandeau dit ce qu'on regarde ; le
 * geste est ailleurs, là où on le cherche.
 */
export function BandeauVisite() {
  const { estInvite } = useAuth()
  if (!estInvite) return null

  return (
    <div className="border-b border-line bg-surface2">
      <div className="mx-auto flex w-[min(100%-2rem,1600px)] flex-wrap items-center gap-x-3 gap-y-1.5 py-2 md:w-[min(100%-3rem,1600px)]">
        <Eye size={16} className="shrink-0 text-textDim" aria-hidden="true" />
        <p className="min-w-0 text-sm text-textDim">
          <span className="font-semibold text-textPrimary">Mode visiteur</span> — tu consultes le catalogue
          des œuvres, en lecture seule.
        </p>
      </div>
    </div>
  )
}
