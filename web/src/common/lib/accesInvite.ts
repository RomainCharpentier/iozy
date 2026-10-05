/**
 * What a visit without an account does not need to reach.
 *
 * <h2>One single list, read by everything that leads somewhere</h2>
 * Routing uses it to send a visitor back to the home page, the two navigation
 * bars use it to avoid showing an entry that would bounce back, and the header
 * shortcuts use it for the same reason. Written three times, it would have
 * diverged at the first screen added - and the divergence would have looked
 * like a tab that sends you home without saying anything.
 *
 * <h2>This is NOT a protection</h2>
 * The protection is on the server side, and it is total: a visit session
 * writes nothing, whatever the route (see SecurityConfig). This only avoids
 * offering doors that lead nowhere - an add screen where every button
 * refuses, an administration page that answers 403 to its own read.
 *
 * <h2>The rule used to decide</h2>
 * A screen is reserved for accounts when its subject is to <b>write</b>, to
 * <b>manage</b> oneself, or to <b>compute on a collection</b>. What a visitor
 * looks at is the catalog: the works and their detail pages. Everything else -
 * progress, statistics, summary, rankings, wishes - is derived from what
 * someone owns, and a visit session owns nothing: these screens would show up
 * empty, which reads as a failure rather than as an answer.
 */
const RESERVEES_AUX_COMPTES = [
  // "Ma collection" is a PERSONAL space: it only shows what one owns or wishes
  // (see correspondAuFiltre), so it would be empty for a visitor - and titled
  // "Ma", which means nothing to them. Its viewable equivalent is the catalog,
  // at `/add`, which stays open.
  '/',
  // Writing in the collection. `/add` is no longer here: it became the entry
  // of the CATALOG, and the add actions it still carries are hidden from a
  // visitor screen by screen (see SearchPage).
  '/scan',
  '/apercu',
  '/import-bgg',
  '/import-photo',
  // Analyzing a listing: each step is a POST, and some of them go out to a
  // provider or to a model. A door open to the whole Internet must not offer
  // that.
  '/purchase-analysis',
  // The tools of the instance and of the shared catalog.
  '/administration',
  '/types',
  '/editions',
  // One's own account - which a visitor does not have.
  '/profile',
  '/settings',
  // And everything that is COMPUTED on a collection: progress, discoveries,
  // statistics, summary, rankings, wishes. A visit session names no owner
  // (see Invite on the server side), so these screens would be exact and
  // empty - zeros and lists with nothing in them, which read as a failure
  // rather than as an answer.
  '/discover',
  '/tier-lists',
  '/stats',
  '/recap',
  '/suggestions',
  '/wishlist',
]

/**
 * Compares by SEGMENT prefix: `/types` covers `/types/new`, without ever
 * catching a `/typesomething` that would have nothing to do with it.
 */
export function estReserveeAuxComptes(chemin: string): boolean {
  return RESERVEES_AUX_COMPTES.some((route) => chemin === route || chemin.startsWith(`${route}/`))
}
