import { Link, useLocation } from 'react-router-dom'
import { FamilySwitcher } from './FamilySwitcher'
import { GlobalShortcuts } from './GlobalShortcuts'
import { destinationsPour, type NavItem } from './navItems'
import { useAuth } from '@/common/hooks/useAuth'

function NavLinkItem({ to, label, icon: Icon, activeWhen }: NavItem) {
  const { pathname } = useLocation()
  const active = activeWhen(pathname)
  return (
  // `Link` and not `NavLink`: React Router recomputes `aria-current` itself
  // from ITS route match (exact for `to="/"`) and overwrites
  // the one we pass it. Measured result: on the detail page of a work, "Ma
  // collection" was indeed painted as the current destination by `activeWhen`
  // but announced nothing anymore - the same inconsistency on `/scan` and
  // `/purchase-analysis` under "Rechercher". We already compute `active`
  // ourselves; all that remains is not to let NavLink contradict it.
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      // The current destination is a RAISED pill (surface + shadow),
      // not a tinted flat color doubled with a line (mockup v4): two signals
      // for the same information, one of which - the line hooked at -10px -
      // overflowed the header.
      className={`flex h-[46px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors ${
        active ? 'bg-surface2 font-semibold text-textPrimary shadow-token-sm ring-1 ring-line' : 'text-textDim hover:bg-rowHover'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.15 : 1.75} />
      {label}
    </Link>
  )
}

/** Desktop navigation (>= 768px, see AppShell.NAV_BREAKPOINT) - the three
 * destinations of NAV_ITEMS, the same list as the thumb bar. Wishes
 * (heart, with badge) and Profile (avatar) stay separate shortcuts,
 * never peer destinations: the Wishes are a reading of Ma
 * collection (product study of 2026-08-27, §16).
 *
 * <p>During a visit without an account, only the destinations that
 * SHOW the collection remain: the others are write screens, and a tab
 * that bounces back to the home page informs nobody (see lib/accesInvite). */
export function DesktopHeader() {
  const { estInvite } = useAuth()
  const destinations = destinationsPour(estInvite)

  return (
    <header className="barre-verre sticky top-0 z-10 hidden h-16 shrink-0 border-b border-line md:block">
      <div className="mx-auto flex h-full w-[min(100%-48px,1600px)] items-center gap-6">
        {/* The brand opens the family (see FamilySwitcher). */}
        <FamilySwitcher />
        <nav className="flex h-full items-center gap-1.5">
          {destinations.map((item) => (
            <NavLinkItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="ml-auto">
          <GlobalShortcuts />
        </div>
      </div>
    </header>
  )
}
