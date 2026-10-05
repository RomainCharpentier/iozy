import { Link } from 'react-router-dom'
import { GlobalShortcuts } from './GlobalShortcuts'

/**
 * Mobile header (< 768px, see AppShell.NAV_BREAKPOINT_PX) - deliberately
 * reduced to what the thumb bar cannot carry: the name of the app, the
 * Wishes and the Profile.
 * <p>
 * The global navigation is that of NAV_ITEMS (see navItems): Wishes and
 * Profile are not part of it - the Wishes are a reading of Ma collection,
 * the Profile is not an intention - and so have no place in the
 * bottom bar.
 * But without any header on mobile, they were reachable nowhere -
 * and with them disappeared Settings, Administration, the export, the yearly
 * recap and the two sharing links (see docs/USER_JOURNEYS.md §12.1).
 * <p>
 * No global menu here: this header must never become the catch-all
 * drawer of all the features. Each tool stays in the space
 * it belongs to.
 */
export function MobileHeader() {
  return (
    <header className="barre-verre sticky top-0 z-10 border-b border-line md:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link to="/" className="flex h-full items-center font-display text-base font-semibold tracking-[-0.02em] text-textPrimary">
          Iozy<span className="text-accent">core</span>
        </Link>
        <div className="ml-auto">
          <GlobalShortcuts compact />
        </div>
      </div>
    </header>
  )
}
