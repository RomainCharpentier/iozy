/**
 * Where we come from, when it is worth offering to go back there.
 *
 * <h2>One single mechanism, for all the screens that open from elsewhere</h2>
 * The detail page already did it well; four other screens hard-coded their
 * destination - a Tier List board ALWAYS went back to `/tier-lists`, even
 * when opened from Discover, and a shelf always to Ma collection (see
 * docs/USER_JOURNEYS.md, UX-8). The button of the screen and the Back
 * button of the browser then said two different things.
 *
 * <h2>Why through `location.state`, when the rest no longer depends on it</h2>
 * Batch 29 removed all `location.state` from the detail page, and for a good
 * reason: the old add screen existed ONLY through it, so an F5 emptied it
 * and a shared link led nowhere. Here, it is the opposite — this state
 * carries no data, only a convenience. If it is missing (page reloaded,
 * received link, arrival from the collection), the back link simply does not
 * show, and the page stays whole. This is the difference between a screen
 * that DEPENDS on a volatile state and a screen that KNOWS how to do without it.
 *
 * <h2>Why not a simple `navigate(-1)`</h2>
 * Because a "Retour" without a destination lies one time out of two: opening
 * a detail page from the search and then opening another one from its
 * relations would go back to the previous detail page, not to the search.
 * Naming the destination means promising exactly what we deliver - and the
 * Back button of the browser keeps doing its job next to it.
 */
export interface Retour {
  /** The route to reopen - `/add`, `/scan`... */
  to: string
  /** What the link announces. The name of the screen, never "Retour" alone. */
  libelle: string
}

export interface EtatRetour {
  retour?: Retour
}

/** Reads the origin of a navigation without ever trusting its shape:
 *  `location.state` is a free bag, which a forged link or an earlier
 *  version of the app can fill differently. */
export function retourDepuis(state: unknown): Retour | null {
  if (!state || typeof state !== 'object') return null
  const retour = (state as EtatRetour).retour
  if (!retour || typeof retour.to !== 'string' || typeof retour.libelle !== 'string') return null
  // An internal route, never an absolute URL: this link must not be able to
  // become a redirect to the outside.
  if (!retour.to.startsWith('/') || retour.to.startsWith('//')) return null
  return retour
}
