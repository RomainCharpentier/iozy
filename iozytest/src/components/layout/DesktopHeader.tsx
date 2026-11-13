import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/components/layout/navItems'
import AppSwitcher from '@/components/layout/AppSwitcher'
import HeaderShortcuts from '@/components/layout/HeaderShortcuts'
import styles from '@/components/layout/AppShell.module.scss'

/**
 * La barre du haut (≥ 1024 px) : trois pièces de verre flottantes, dessinées
 * par les classes d'IozyKit (`.iozy-barre--eclatee`, `.iozy-verre`).
 * - la capsule : la marque, qui ouvre les autres apps Iozy, puis les
 *   destinations de CETTE app, « Jouer » et « Éditeur » ;
 * - les raccourcis (thème, réglages) et l'avatar.
 *
 * IozyTest est une app voisine d'IozyCore depuis le lot 234 : elle ne recopie
 * plus la barre de la collection (ni ses cinq destinations, ni son champ
 * « Chercher ou ajouter »). On passe de l'une à l'autre par la marque.
 */
export default function DesktopHeader() {
  const { pathname } = useLocation()
  return (
    <header className={`iozy-barre iozy-barre--eclatee ${styles.header}`}>
      <div className="iozy-verre iozy-barre__pilule">
        <div className="iozy-barre__marque">
          <AppSwitcher />
        </div>
        <nav className="iozy-barre__nav" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={item.activeWhen(pathname) ? 'page' : undefined}
              className="iozy-barre__lien"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="iozy-barre__espace" />
      <HeaderShortcuts />
    </header>
  )
}
