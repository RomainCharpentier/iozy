import { Link } from 'react-router-dom'
import { Jaquette } from '@/common/components/Jaquette'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import type { EntityTypeDto, ToBuyLineDto } from '@/common/types/api'
import { nomJeLAi, sousTitreLigne, titreLigne } from './libelles'

/**
 * One thing to buy: its cover, what it is, why it is there, and "Je l'ai".
 * No state label under it: the line itself is what is missing, and its
 * outline in the vivid tone says so (lot 210).
 */
export function LigneAAcheter({
  ligne,
  type,
  onJeLAi,
}: {
  ligne: ToBuyLineDto
  /** The type of the work: its `aspectKey` gives the shape of the cover. Unknown while loading. */
  type: EntityTypeDto | undefined
  onJeLAi: () => void
}) {
  const couverture = ligne.elements[0]?.coverImageUrl ?? ligne.coverImageUrl
  const titre = titreLigne(ligne)
  // Same height for every line; the width follows the shape of the type
  // (a book is tall, a board game box is square).
  const forme = `h-[74px] max-w-[132px] shrink-0 rounded-lg ${getEntityTypeVisual(type).aspectClassName}`
  return (
    <li className="flex items-center gap-3 border-b border-ligneVerre py-2.5 last:border-b-0 sm:gap-4">
      <Link
        to={`/entity/${ligne.entityId}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl sm:gap-4"
        aria-label={`${titre} : ouvrir la fiche`}
      >
        <Jaquette
          src={couverture}
          className={`${forme} object-cover`}
          repli={
            <span
              aria-hidden="true"
              className={`${forme} flex items-center justify-center bg-surface2 font-display text-lg font-bold text-textDim`}
            >
              {ligne.title.charAt(0).toUpperCase()}
            </span>
          }
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold text-textPrimary sm:text-base">{titre}</span>
          <span className="truncate text-[13px] text-textDim">{sousTitreLigne(ligne)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onJeLAi}
        aria-label={nomJeLAi(ligne)}
        className="iozy-teinte inline-flex min-h-11 shrink-0 items-center rounded-full border border-vive px-4 text-sm font-bold text-accentText transition hover:bg-accentTint active:scale-[0.98]"
      >
        Je l’ai
      </button>
    </li>
  )
}
