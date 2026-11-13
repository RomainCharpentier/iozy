import type { ReactNode } from 'react'

/**
 * The head of a destination of the bar (lot 224): the name in the display
 * font, very big, a line that counts underneath, and the controls of the
 * page on the right.
 *
 * <h2>Why a component</h2>
 * Sorties drew it inline (lot 215) while Collection, its rooms and the
 * Catalogue kept the small title of the tool screens: side by side, the
 * destinations did not look like one app. The tool screens (Éditions,
 * Types, Réglages) keep {@link EnTeteSection}: a form needs no poster.
 *
 * The size follows the width, from 3.25rem on a phone to 8.5rem; a long
 * name ("Jeu de société", a custom type) wraps between its words rather
 * than overflowing, and breaks inside a word only when it must.
 */
export function GrandTitre({
  titre,
  surTitre,
  sousTitre,
  action,
}: {
  titre: ReactNode
  /** A few words above, in small capitals: where the page belongs. */
  surTitre?: ReactNode
  sousTitre?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-3">
      <div className="min-w-0">
        {surTitre && <p className="iozy-teinte mb-2 text-[13px] font-bold tracking-[0.16em] text-accentText uppercase">{surTitre}</p>}
        <h1 className="font-display text-[clamp(3.25rem,10vw,8.5rem)] leading-[0.85] font-bold tracking-[-0.06em] [overflow-wrap:break-word] text-textPrimary">
          {titre}
        </h1>
        {sousTitre && <p className="mt-3 text-[15px] text-textDim">{sousTitre}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}
