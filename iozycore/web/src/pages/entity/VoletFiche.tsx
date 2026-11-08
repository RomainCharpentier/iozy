import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * The side panel of the entity page (lot 213): everything that is not "what I
 * have, what I miss" - notes, tags, rankings, readings, editions, the inspector
 * and its edit mode, relationships, reload, rename, delete. The page keeps the
 * count and the elements; the tools are one click away, none was dropped.
 *
 * <h2>A panel, not a dialog</h2>
 * The page stays readable and usable beside it on a wide screen: no veil, no
 * trapped focus. Escape or the close button puts it away and gives the focus
 * back to the button that opened it.
 */
export function VoletFiche({
  ouvert,
  onFermer,
  retourFocus,
  children,
}: {
  ouvert: boolean
  onFermer: () => void
  /** The button that opened the panel: the focus goes back there. */
  retourFocus: React.RefObject<HTMLButtonElement | null>
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ouvert) return
    ref.current?.focus()
    const surTouche = (event: KeyboardEvent) => {
      // A field or an armed gesture inside handles its own Escape first.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onFermer()
        retourFocus.current?.focus()
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert, onFermer, retourFocus])

  if (!ouvert) return null
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Notes, tags et outils"
      className="iozy-verre iozy-verre--fort fixed inset-x-0 top-0 bottom-0 z-40 flex flex-col overflow-y-auto overscroll-contain rounded-none p-4 outline-none md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:w-[min(600px,calc(100vw-1.5rem))] md:rounded-[28px] md:p-6"
    >
      <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-textPrimary">Notes, tags et outils</h2>
        <button
          type="button"
          onClick={() => {
            onFermer()
            retourFocus.current?.focus()
          }}
          aria-label="Fermer le volet"
          className="iozy-verre flex size-11 items-center justify-center rounded-full text-textPrimary"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </aside>
  )
}
