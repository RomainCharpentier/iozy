import { Link, useLocation } from 'react-router-dom'
import { ChampRecherche } from './ChampRecherche'
import { GlobalShortcuts } from './GlobalShortcuts'
import { LienNav } from './LienNav'
import { destinationsPour } from './navItems'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * The top bar of the "plein cadre" redesign (lot 210), from 1024 px: it floats
 * over the blurred cover in three pieces of glass, like the validated
 * prototype - the capsule of the brand and the destinations, the
 * "Chercher ou ajouter" field, and the shortcuts with the avatar. The same
 * classes (iozykit `.iozy-barre`) draw the bar of IozyTest and of the home
 * page of the site.
 *
 * <p>The destinations are NAV_ITEMS, the list the thumb bar reads too.
 */
export function BarreDuHaut() {
  const { pathname } = useLocation()
  const { estInvite } = useAuth()
  const destinations = destinationsPour(estInvite)

  return (
    <header className="iozy-barre iozy-barre--eclatee max-lg:!hidden">
      <div className="iozy-verre iozy-barre__pilule iozy-teinte shrink-0">
        <Link to="/" className="iozy-barre__marque" aria-label="Iozy, accueil">
          Iozy
        </Link>
        <nav className="iozy-barre__nav" aria-label="Navigation principale">
          {destinations.map((item) => (
            <LienNav key={item.cle} item={item} active={item.activeWhen(pathname)} className="iozy-barre__lien iozy-teinte">
              {item.label}
            </LienNav>
          ))}
        </nav>
      </div>
      <div className="iozy-barre__espace" />
      <ChampRecherche />
      <GlobalShortcuts />
    </header>
  )
}
