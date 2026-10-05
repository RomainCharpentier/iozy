import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ScanLine } from 'lucide-react'
import { NAV_ITEMS } from './navItems'
import { estReserveeAuxComptes } from '@/common/lib/accesInvite'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * Thumb bar (< 768px, see AppShell.NAV_BREAKPOINT) - replaced by
 * DesktopHeader above that. The same destinations as it, read from the same
 * list (see navItems): two copies "kept manually in sync"
 * were two copies bound to diverge.
 *
 * <p>Plus the Scan shortcut, which is NOT one more destination (no
 * aria-current, separated by a border) - just a one-hand access to an
 * entry point already covered by Rechercher.
 *
 * <p>Each tab shows its SHORT label (see NavItem.labelCourt):
 * "Ma collection" becomes "Collection" there, and the full label stays on
 * the desktop bar. There were four from 2026-08-27 to batch 137; three
 * fit all the better on 375 px.
 *
 * <p>Two during a visit without an account, and the Scan shortcut disappears with
 * them: these are WRITE destinations (see lib/accesInvite), and a
 * tab that would immediately send back to the home page reads as a failure. The same
 * list serves as judge here and in routing, so that neither says
 * the opposite of the other.
 */
export function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { estInvite } = useAuth()
  const destinations = estInvite ? NAV_ITEMS.filter((item) => !estReserveeAuxComptes(item.to)) : NAV_ITEMS

  return (
    <nav className="barre-verre fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-1 border-t border-line px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
      {destinations.map(({ to, labelCourt, icon: Icon, activeWhen }) => {
        const active = activeWhen(pathname)
        return (
          // `Link` and not `NavLink`: see DesktopHeader - NavLink overwrites
          // the `aria-current` we pass it with the one from ITS route
          // match, which ignores `activeWhen`.
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className="flex min-w-0 flex-1 items-stretch justify-center"
          >
            <span
              className={`flex min-h-[54px] w-full max-w-[84px] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] font-semibold transition-colors ${
                active ? 'bg-accentTint text-accentText' : 'text-textDim'
              }`}
            >
              <Icon size={21} strokeWidth={active ? 2.15 : 1.75} />
              <span className="w-full truncate text-center">{labelCourt}</span>
            </span>
          </Link>
        )
      })}
      {!estInvite && (
        <>
          <span className="my-2 w-px shrink-0 bg-surface2" aria-hidden="true" />
          <button
            type="button"
            onClick={() => navigate('/scan')}
            title="Scanner un code-barres"
            className="my-1 flex min-h-[46px] w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-accent text-accentInk shadow-token-accent active:translate-y-0.5"
          >
            <ScanLine size={20} strokeWidth={2} />
            <span className="text-[10px] font-bold tracking-wide uppercase">Scan</span>
          </button>
        </>
      )}
    </nav>
  )
}
