import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { gradientFor } from '@/common/theme/gradient'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'

/** What a tile says about the work, with its frame alone (see `etat`). */
export type EtatTuile = 'possede' | 'manquant' | 'envie'

/** The frame of each state. An owned work is simply whole; a missing one is
 *  faded and dashed, like an empty slot on the shelf; a wanted one is ringed
 *  with the accent, like its heart. */
const CADRE_PAR_ETAT: Record<EtatTuile, string> = {
  possede: '',
  manquant: 'opacity-45 outline-2 outline-offset-2 outline-dashed outline-lineStrong',
  envie: 'outline-2 outline-offset-2 outline-accent',
}

/** The same state, for whoever cannot see the frame. Nothing for an owned
 *  work: that is the default, as on a shelf. */
const PHRASE_PAR_ETAT: Record<EtatTuile, string | null> = {
  possede: null,
  manquant: 'Pas encore possédé',
  envie: 'Dans tes envies',
}

interface CoverTileProps {
  title: string
  /** Real cover (Jikan/Google Books/Open Library), if a match
   * was found when adding. Absent for a free-text add, or
   * if the metadata search returned nothing - the gradient then stays
   * the fallback, never a broken image. */
  imageUrl?: string | null
  showBadge?: boolean
  /** Secondary line under the title (e.g. "17/26 tomes" in the grouped view by
   * series on My collection, "Tome 3 · Perfect Edition" in the ungrouped view,
   * "Possédé" for a type without the notion of volume) - absent by default,
   * does not affect the other uses of this component (Relations). */
  subtitle?: string
  /** A faint line under the subtitle, for what the reader should know
   * before opening ("Aucun tome connu — à saisir à la main"). */
  mention?: string
  /** Small type badge ("Manga", "Jeu vidéo"...) under the subtitle - a
   * separate element from `subtitle`, never a fallback for one another (see
   * the layout redesign that was asked: a tile must stay recognizable by
   * object/type/state, 3 separate pieces of information, not 2 sharing one
   * single line). Absent if the type is not known at this place. */
  typeLabel?: string
  /** e.g. "aspect-[2/3]" (default) or "aspect-square" for horizontal lists. */
  aspectClassName?: string
  /** Single priority signal (see the V1.2 mockup - "one single signal per
   * card, never stacked": each potential badge source chooses
   * ITSELF the most relevant signal before passing it here, this
   * component only shows what it is given, never stacking
   * several independent signals). */
  signal?: string
  /** Key used for the fallback gradient (see gradientFor) - `title` by
   * default. To override when several tiles share the same title but
   * must stay visually distinct without a real cover (e.g. the
   * volumes of the same series in the ungrouped view - see `aplatirEnElements`, which
   * adds the subtitle "Tome N" there so as not to show the same gradient on
   * every volume for lack of a cover of its own). */
  gradientKey?: string
  /** The state of the work, said by the object itself (lot 198): never a
   * word on the tile, the sentence only exists for screen readers. Absent:
   * no state at all - a visitor, or a shelf that only shows what is owned. */
  etat?: EtatTuile
  /** A control that lives on the tile, at the foot of its text (the heart
   * of the catalogue). A sibling of the button, never inside it: a button
   * in a button is not valid markup, and each target keeps its own name. */
  action?: ReactNode
  onClick?: () => void
}

/**
 * Real cover when an external source provided one (Jikan / Google
 * Books via ISBN scan / Open Library), with the deterministic gradient (computed
 * from the title) as a fallback - free-text entry, search failure, or simple
 * image loading failure.
 * <p>
 * Image frame and metadata SEPARATED (see the layout redesign that was asked):
 * no more title/subtitle as an overlay on the cover (readable only
 * thanks to a dark gradient over the image, which darkened it for
 * nothing) - the text now lives under the image, as normal text. Only
 * exception: the small "owned" badge (`showBadge`), which stays by nature
 * information attached to the cover itself. Mirror of CoverTile.swift
 * (to be reconciled separately if needed, out of scope here).
 */
export function CoverTile({
  title,
  imageUrl,
  showBadge = false,
  subtitle,
  mention,
  typeLabel,
  aspectClassName = 'aspect-[2/3]',
  gradientKey,
  signal,
  etat,
  action,
  onClick,
}: CoverTileProps) {
  const phrase = etat ? PHRASE_PAR_ETAT[etat] : null
  return (
    <div className="relative flex w-full min-w-0 flex-col">
      {/* Lifts by half a pixel grid under the pointer and settles back under
          the finger (batch 191): the tile answers before it is opened. `group`
          so that its frame deepens its shadow at the same time. */}
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full min-w-0 flex-col text-left ${onClick ? 'cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]' : 'cursor-default'}`}
      >
        <div
          className={`relative w-full overflow-hidden rounded-2xl ring-1 ring-line shadow-token-sm transition-shadow duration-200 group-hover:shadow-token-md ${aspectClassName} ${etat ? CADRE_PAR_ETAT[etat] : ''}`}
          // The gradient stays UNDER the cover: it is what shows while the
          // image fades in, and what remains when it fails.
          style={{ background: gradientFor(gradientKey ?? title) }}
        >
          {/* Loaded when it gets close to the screen, not all at once: a
              collection of 300 series is 300 covers from Google Books
              at the first render (batch 141). It fades in once there, and
              a URL that fails leaves the gradient alone (Jaquette). */}
          <Jaquette
            src={imageUrl}
            className={`absolute inset-0 h-full w-full object-cover ${etat === 'manquant' ? 'saturate-50' : ''}`}
            repli={null}
          />
          {showBadge && (
            <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accentInk">
              <Check size={14} strokeWidth={3} />
            </span>
          )}
        </div>
        {/* Literal spacing that was asked: frame -> 8px -> title -> 4px ->
            subtitle -> 6px -> badge. With a control at the foot of the tile,
            the text keeps clear of it and is at least as tall. */}
        <div className={`mt-2 flex min-w-0 flex-col ${action ? 'min-h-11 pr-11' : ''}`}>
          <TexteCoupe texte={title} className="line-clamp-2 text-sm font-semibold text-textPrimary" />
          {subtitle && <TexteCoupe texte={subtitle} className="mt-1 line-clamp-1 text-xs text-textDim" />}
          {mention && <span className="mt-0.5 text-xs text-faint">{mention}</span>}
          {typeLabel && (
            <span className="mt-1.5 w-fit rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-textDim">
              {typeLabel}
            </span>
          )}
          {signal && (
            <span className="mt-1.5 w-fit rounded-full bg-accentTint px-2 py-0.5 text-[11px] font-semibold text-accentText">
              {signal}
            </span>
          )}
          {phrase && <span className="sr-only">{phrase}</span>}
        </div>
      </button>
      {action && <div className="absolute right-0 bottom-0 z-10">{action}</div>}
    </div>
  )
}
