import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'
import ThemeButton from '@/components/layout/ThemeButton'
import styles from '@/components/layout/AppShell.module.scss'

/** Les deux raccourcis de l'en-tête : le thème et les réglages. Ce ne sont
 *  pas des destinations (voir navItems), c'est ce qui n'appartient à aucune. */
export default function HeaderShortcuts() {
  const { pathname } = useLocation()
  return (
    <div className={styles.shortcuts}>
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
  )
}
