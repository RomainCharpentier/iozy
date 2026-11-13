import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'
import ThemeButton from '@/components/layout/ThemeButton'
import AccountLink from '@/components/layout/AccountLink'
import styles from '@/components/layout/AppShell.module.scss'

/** Les raccourcis de l'en-tête, dans une capsule de verre : le thème et les
 *  réglages ; puis l'avatar, commun à toutes les apps. L'éditeur est revenu
 *  dans les destinations de la barre (lot 234) : il n'est plus doublé ici. */
export default function HeaderShortcuts() {
  const { pathname } = useLocation()
  return (
    <div className={styles.shortcuts}>
      <div className={`iozy-verre ${styles.shortcutGroup}`}>
        <ThemeButton />
        <Link
          to="/settings"
          // L'origine, pour que le lien retour des réglages NOMME d'où l'on vient.
          state={{ from: pathname }}
          className={styles.iconBtn}
          title="Réglages"
          aria-label="Réglages"
          aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
        >
          <Settings size={17} />
        </Link>
      </div>
      <AccountLink />
    </div>
  )
}
