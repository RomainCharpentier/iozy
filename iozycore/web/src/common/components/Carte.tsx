import type { ReactNode } from 'react'

/**
 * The content surface of mockup v4: 20px corners, `surface` background,
 * soft shadow, 24px of inner breathing room.
 *
 * <h2>A constant AND a component</h2>
 * The constant is used where the card is already another element (a `<section>`,
 * an `<article>`, a card-button) and where wrapping it in a `<div>` would add
 * a node for nothing. The component is used everywhere else. Both say the
 * same thing - that is the point: the repository had sixteen different ways of writing
 * "a card" (`p-2`, `p-3`, `p-4`, `p-5`, `p-6`, with or without a shadow), so
 * sixteen cards that did not quite look alike.
 *
 * <h2>The border, absent from the mockup, is kept</h2>
 * The mockup only exists in the light theme, where the shadow is enough to lift the
 * card off the background. In the dark theme the shadow is black on almost-black: only
 * the `surface` / `background` gap remains, and a card placed on another one
 * disappears. The `surface2` border is what makes it hold in
 * both themes - invisible in light, structuring in dark.
 */
export const CLASSE_CARTE = 'rounded-[20px] border border-line bg-surface p-5 shadow-token-sm sm:p-6'

/** Same card, in a danger zone: no shadow or border, a tinted background
 *  that signals by itself that we are no longer in the ordinary content (see the
 *  mockup v4, block "Supprimer cette fiche"). */
export const CLASSE_CARTE_DANGER = 'rounded-[20px] bg-dangerTint p-5'

export function Carte({
  children,
  ton = 'neutre',
  className = '',
}: {
  children: ReactNode
  ton?: 'neutre' | 'danger'
  className?: string
}) {
  return <div className={`${ton === 'danger' ? CLASSE_CARTE_DANGER : CLASSE_CARTE} ${className}`}>{children}</div>
}
