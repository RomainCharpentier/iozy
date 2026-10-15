import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/components/layout/navItems'
import Wordmark from '@/components/layout/Wordmark'
import HeaderShortcuts from '@/components/layout/HeaderShortcuts'
import styles from '@/components/layout/AppShell.module.scss'

/** Navigation de bureau (≥ 768 px) : le mot-marque, les destinations en
 *  pastilles, les raccourcis à droite. Masquée par CSS sous 768 px. */
export default function DesktopHeader() {
  const { pathname } = useLocation()
  return (
    <header className={`${styles.header} ${styles.glass}`}>
      <div className={styles.headerInner}>
        <Wordmark />
        <nav className={styles.nav} aria-label="Navigation principale">
          {NAV_ITEMS.map(({ to, label, icon: Icon, activeWhen }) => {
            const active = activeWhen(pathname)
            return (
              // `Link` et non `NavLink` : NavLink recalcule `aria-current` depuis
              // SA correspondance de route et écraserait celle d'`activeWhen`.
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`${styles.navPill} ${active ? styles.navPillActive : ''}`}
              >
                <Icon size={20} strokeWidth={active ? 2.15 : 1.75} />
                {label}
              </Link>
            )
          })}
        </nav>
        <HeaderShortcuts />
      </div>
    </header>
  )
}
