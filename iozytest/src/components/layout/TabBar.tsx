import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/components/layout/navItems'
import styles from '@/components/layout/AppShell.module.scss'

/** Barre au pouce (< 768 px) : les mêmes destinations que l'en-tête de
 *  bureau, lues dans la même liste. Masquée par CSS dès 768 px. */
export default function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav className={`${styles.tabBar} ${styles.glass}`} aria-label="Navigation principale">
      {NAV_ITEMS.map(({ to, label, icon: Icon, activeWhen }) => {
        const active = activeWhen(pathname)
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
          >
            <span className={styles.tabInner}>
              <Icon size={21} strokeWidth={active ? 2.15 : 1.75} />
              <span className={styles.tabLabel}>{label}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
