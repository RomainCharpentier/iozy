import { Link, useLocation } from 'react-router-dom'
import { PenLine, Settings } from 'lucide-react'
import ThemeButton from '@/components/layout/ThemeButton'
import AccountLink from '@/components/layout/AccountLink'
import styles from '@/components/layout/AppShell.module.scss'

/** Les raccourcis de l'en-tête, dans une capsule de verre : le thème,
 *  l'éditeur, les réglages ; puis l'avatar, commun à toutes les apps. Depuis
 *  la barre du site (lot 210), « Jouer » est l'entrée IozyTest de la barre et
 *  l'éditeur, qui nourrit le jeu, passe ici. */
export default function HeaderShortcuts() {
  const { pathname } = useLocation()
  return (
    <div className={styles.shortcuts}>
      <div className={`iozy-verre ${styles.shortcutGroup}`}>
        <ThemeButton />
        <Link
          to="/editor"
          className={styles.iconBtn}
          title="Éditeur"
          aria-label="Éditeur"
          aria-current={pathname.startsWith('/editor') ? 'page' : undefined}
        >
          <PenLine size={17} />
        </Link>
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
