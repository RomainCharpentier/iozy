import type { ReactNode } from 'react'

/**
 * The header of a screen or of a large section: a title, the sentence that says
 * what we are looking at, and the main action on the right.
 *
 * <h2>Why a component rather than three repeated lines of JSX</h2>
 * The twenty-eight screens of the application all wrote their own header by
 * hand, and mockup v4 (detail page of a work) finally fixes its shape:
 * tight Space Grotesk title, subtitle right below, action aligned
 * on the BASELINE of the bottom of the title block - not vertically centered,
 * not stuck at the top. Copying that twenty-eight times guarantees that the
 * twenty-ninth drifts.
 *
 * <h2>The subtitle is not decorative</h2>
 * In the mockup, each section has one and it always says something true
 * and computed ("Black Édition · 1 tome possédé, 5 manquants"),
 * never a slogan. This is why it accepts a ReactNode: a sentence can
 * contain a count, a pill, a link.
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
  /** 1 for the screen title (only one per page, see Batch 9 - one `<h1>` per
   *  screen, checked by grep), 2 for a section inside. */
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
      {/* `shrink-0` without `ml-auto`: `justify-between` already places the action on
          the right, and an `ml-auto` would push it to the right AGAIN after a line
          wrap, detaching it from the title instead of putting it below. */}
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
