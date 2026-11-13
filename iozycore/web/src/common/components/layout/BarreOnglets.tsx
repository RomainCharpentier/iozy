import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ChampRecherche } from './ChampRecherche'
import { LienNav } from './LienNav'
import { destinationsPour } from './navItems'
import { useAuth } from '@/common/hooks/useAuth'
import { useModalA11y } from '@/common/hooks/useModalA11y'

/**
 * The thumb bar (under 1024 px, see AppShell.NAV_BREAKPOINT_PX): a capsule
 * of glass at the bottom of the screen with the same destinations as the top
 * bar (one list, navItems), and the search, which opens as a sheet over the
 * bar. Each target is at least 52 px high.
 */
export function BarreOnglets() {
  const { pathname } = useLocation()
  const { estInvite } = useAuth()
  // IozyTest, the other app, has its button in the top of the screen on a phone:
  // six tabs fit the thumb, seven do not.
  const destinations = destinationsPour(estInvite)
  const [recherche, setRecherche] = useState(false)
  const feuille = useModalA11y<HTMLDivElement>(recherche, () => setRecherche(false))

  return (
    <>
      <nav aria-label="Navigation principale" className="iozy-verre iozy-onglets iozy-teinte lg:!hidden">
        {destinations.map((item) => {
          const Icone = item.icon
          const active = item.activeWhen(pathname)
          return (
            <LienNav key={item.cle} item={item} active={active} className="iozy-onglets__onglet iozy-teinte">
              <Icone size={20} strokeWidth={active ? 2.15 : 1.75} aria-hidden="true" />
              <span>{item.labelCourt}</span>
            </LienNav>
          )
        })}
        <button
          type="button"
          onClick={() => setRecherche(true)}
          aria-expanded={recherche}
          className="iozy-onglets__onglet"
        >
          <Search size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>Chercher</span>
        </button>
      </nav>

      {recherche && (
        <>
          <div className="voile-entree fixed inset-0 z-40 bg-scrim lg:hidden" onClick={() => setRecherche(false)} />
          <div
            ref={feuille}
            role="dialog"
            aria-modal="true"
            aria-label="Chercher ou ajouter"
            className="iozy-verre iozy-verre--fort feuille-entree fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 rounded-[26px] p-3 lg:hidden"
          >
            <ChampRecherche autoFocus className="w-full" surSoumission={() => setRecherche(false)} />
          </div>
        </>
      )}
    </>
  )
}
