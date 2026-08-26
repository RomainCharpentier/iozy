import type { ReactNode } from 'react'

/**
 * L'en-tête d'un écran ou d'une grande section : un titre, la phrase qui dit
 * ce qu'on regarde, et l'action principale à droite.
 *
 * <h2>Pourquoi un composant plutôt que trois lignes de JSX répétées</h2>
 * Les vingt-huit écrans de l'application écrivaient tous leur propre en-tête à
 * la main, et la maquette v4 (fiche d'une œuvre) en fixe enfin la forme :
 * titre en Space Grotesk resserré, sous-titre juste dessous, action alignée
 * sur la LIGNE DE BASE du bas du bloc de titre - pas centrée verticalement,
 * pas collée en haut. Recopier ça vingt-huit fois, c'est garantir que la
 * vingt-neuvième dérive.
 *
 * <h2>Le sous-titre n'est pas décoratif</h2>
 * Dans la maquette, chaque section en porte un et il dit toujours quelque
 * chose de vrai et de calculé ("Black Édition · 1 tome possédé, 5 manquants"),
 * jamais un slogan. C'est pour ça qu'il accepte un ReactNode : une phrase peut
 * contenir un compte, une pastille, un lien.
 */
export function EnTeteSection({
  titre,
  sousTitre,
  action,
  niveau = 2,
  className = '',
}: {
  titre: ReactNode
  sousTitre?: ReactNode
  action?: ReactNode
  /** 1 pour le titre d'écran (un seul par page, voir le Lot 9 - un `<h1>` par
   *  écran, vérifié par grep), 2 pour une section à l'intérieur. */
  niveau?: 1 | 2
  className?: string
}) {
  const Titre = niveau === 1 ? 'h1' : 'h2'
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-7 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <Titre className="font-display text-2xl font-bold tracking-[-0.025em] text-textPrimary">{titre}</Titre>
        {sousTitre && <p className="mt-1 text-sm text-textDim">{sousTitre}</p>}
      </div>
      {/* `shrink-0` sans `ml-auto` : `justify-between` place déjà l'action à
          droite, et un `ml-auto` la pousserait encore à droite APRÈS un retour
          à la ligne, la détachant du titre au lieu de la ranger dessous. */}
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
