import { Plus } from 'lucide-react'

/** La tuile d'un tome, telle que la maquette v4 la dessine : la jaquette (ou
 *  sa place), puis SOUS elle son numéro et son état en toutes lettres.
 *
 *  Avant, le numéro n'apparaissait que faute de jaquette et l'état se
 *  devinait à une pastille : une grille de soixante-douze tuiles ne se lisait
 *  qu'en survolant. La légende coûte deux lignes de texte et rend la grille
 *  lisible d'un coup d'œil - y compris au lecteur d'écran, qui n'avait que le
 *  `aria-label` du bouton. */
export function TuileTome({
  numero,
  etat,
  isActive,
  onClick,
  children,
}: {
  numero: number
  etat: 'owned' | 'missing'
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const possede = etat === 'owned'
  return (
    <article className="flex w-full max-w-[168px] flex-col gap-2.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={possede ? `Voir le tome ${numero}` : `Ajouter le tome ${numero}`}
        // Sélection = tuile <-> panneau ouvert (voir VolumeInteractionPanel) :
        // anneau accent discret, jamais un gros effet - juste de quoi
        // reconnaître quelle carte a ouvert le panneau actuellement affiché.
        className={`group relative flex aspect-[2/3] w-full flex-col items-center justify-center gap-3.5 overflow-hidden rounded-2xl text-left transition ${
          possede ? 'bg-surface2 shadow-token-md' : 'border border-line bg-softBtn'
        } ${isActive ? 'ring-2 ring-accent' : ''}`}
      >
        {children}
      </button>
      <div className="min-w-0">
        <div className={`truncate text-sm font-medium ${possede ? 'text-textPrimary' : 'text-textDim'}`}>
          Tome {numero}
        </div>
        <div className={`truncate text-xs ${possede ? 'text-accentText' : 'text-faint'}`}>
          {possede ? 'Dans ma collection' : 'Manquant'}
        </div>
      </div>
    </article>
  )
}

/** L'affordance « Je l'ai » de la maquette, posée sur une tuile manquante.
 *  Un `span`, jamais un bouton : la tuile entière EST déjà le bouton, et
 *  imbriquer deux boutons est invalide. Le clic ouvre le panneau du tome, qui
 *  fait « je l'ai » et tout le reste (état, prix, renumérotation). */
export function PastilleJeLAi() {
  return (
    <span className="pointer-events-none flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-textPrimary shadow-token-sm transition-colors group-hover:bg-accent group-hover:text-accentInk">
      <Plus size={12} strokeWidth={2.2} />
      Je l'ai
    </span>
  )
}

