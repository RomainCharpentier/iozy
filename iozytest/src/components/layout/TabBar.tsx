import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/components/layout/navItems'
import styles from '@/components/layout/AppShell.module.scss'

/** Barre au pouce (< 1024 px) : la capsule de verre d'IozyKit
 *  (`.iozy-onglets`), avec les destinations de cette app, comme la barre du
 *  haut. Les autres apps Iozy s'ouvrent par la marque, en haut de l'écran. */
export default function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav className={`iozy-verre iozy-onglets ${styles.tabBar}`} aria-label="Navigation principale">
      {NAV_ITEMS.map(({ to, label, icon: Icone, activeWhen }) => {
        const actif = activeWhen(pathname)
        return (
          <Link key={to} to={to} aria-current={actif ? 'page' : undefined} className="iozy-onglets__onglet">
            <Icone size={20} strokeWidth={actif ? 2.15 : 1.75} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
