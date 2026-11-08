import type { ReactNode } from 'react'

/**
 * Something the collection does not have yet - a volume of a series, a game
 * of a licence, an expansion of a box (lot 210).
 *
 * <h2>The shape says the state</h2>
 * No "Manquant" written under it: an outline in the vivid tone of the cover,
 * which breathes (iozykit `.iozy-manque`; still under reduced motion). The
 * label inside is the element itself ("12", "Marins"), and the accessible
 * name says what a click does: "<label> : je l'ai".
 *
 * <h2>One gesture</h2>
 * A click adds it to the collection: adding destroys nothing, so it needs no
 * confirmation. Removing an owned element stays a two-step gesture,
 * elsewhere.
 */
export function ElementManquant({
  libelle,
  onJeLAi,
  className = '',
  immobile = false,
  children,
}: {
  /** What the element is, read aloud: "Tome 12". */
  libelle: string
  onJeLAi: () => void
  /** The shape of the element (its aspect ratio, its size). */
  className?: string
  /** Still outline: what is missing no longer counts (a paused or dropped work, lot 213). */
  immobile?: boolean
  /** What is drawn inside; the label itself when absent. */
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onJeLAi}
      aria-label={`${libelle} : je l'ai`}
      title={`${libelle} : je l'ai`}
      className={`iozy-manque iozy-teinte relative flex items-end justify-start overflow-hidden rounded-xl p-2 text-left font-display font-bold ${immobile ? 'animate-none!' : ''} ${className}`}
    >
      {children ?? libelle}
    </button>
  )
}
