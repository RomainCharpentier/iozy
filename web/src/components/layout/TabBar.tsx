import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ScanLine } from 'lucide-react'
import { NAV_ITEMS } from './navItems'
import { estReserveeAuxComptes } from '../../lib/accesInvite'
import { useAuth } from '../../lib/useAuth'

/**
 * Barre du pouce (< 768px, voir AppShell.NAV_BREAKPOINT) - remplacée par
 * DesktopHeader au-delà. Les mêmes destinations que lui, lues dans la même
 * liste (voir navItems) : deux copies « gardées manuellement synchronisées »
 * étaient deux copies vouées à diverger.
 *
 * <p>Plus le raccourci Scan, qui n'est PAS une destination de plus (pas
 * d'aria-current, séparé par une bordure) - juste un accès une-main vers un
 * point d'entrée déjà couvert par Rechercher.
 *
 * <p>Quatre onglets tiennent sur 375 px parce que chacun affiche son libellé
 * COURT (voir NavItem.labelCourt) : « Analyser une annonce » y devient
 * « Annonce », et le libellé complet reste sur la barre desktop.
 *
 * <p>Deux pendant une visite sans compte, et le raccourci Scan disparaît avec
 * eux : ce sont des destinations d'ÉCRITURE (voir lib/accesInvite), et un
 * onglet qui renverrait aussitôt à l'accueil se lit comme une panne. La même
 * liste sert de juge ici et au routage, pour qu'aucun des deux ne dise
 * l'inverse de l'autre.
 */
export function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { estInvite } = useAuth()
  const destinations = estInvite ? NAV_ITEMS.filter((item) => !estReserveeAuxComptes(item.to)) : NAV_ITEMS

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-1 border-t border-surface2 bg-surface px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
      {destinations.map(({ to, labelCourt, icon: Icon, activeWhen }) => {
        const active = activeWhen(pathname)
        return (
          // `Link` et non `NavLink` : voir DesktopHeader - NavLink écrase
          // l'`aria-current` qu'on lui passe par celui de SA correspondance
          // de route, qui ignore `activeWhen`.
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
            <span className="text-[9px] font-bold tracking-wide uppercase">Scan</span>
          </button>
        </>
      )}
    </nav>
  )
}
