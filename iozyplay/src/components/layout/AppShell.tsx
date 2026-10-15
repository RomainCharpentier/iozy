import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopHeader from '@/components/layout/DesktopHeader'
import MobileHeader from '@/components/layout/MobileHeader'
import TabBar from '@/components/layout/TabBar'
import styles from '@/components/layout/AppShell.module.scss'
import appStyles from '@/App.module.scss'

/** Trois largeurs de contenu nommées plutôt que des tests de route épars :
 *  `wide` pour l'éditeur (tables), `narrow` pour les réglages (formulaire),
 *  `medium` pour tout ce qui se joue. */
type ContentWidth = 'wide' | 'medium' | 'narrow'

function contentWidthFor(pathname: string): ContentWidth {
  if (pathname.startsWith('/editor')) return 'wide'
  if (pathname.startsWith('/settings')) return 'narrow'
  return 'medium'
}

/** Les écrans qui vivent HORS de la coquille : la partie (plein écran, son
 *  propre bandeau et sa propre barre) et la porte d'entrée (le nom du joueur),
 *  comme la page de connexion d'IozyCore. */
function isBare(pathname: string): boolean {
  return pathname === '/game' || pathname === '/username'
}

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/**
 * La coquille : en-tête (bureau) ou en-tête compact + barre au pouce (mobile),
 * la grille de page, le pied de page. Un seul point de bascule, 768 px, tenu
 * par le CSS de AppShell.module.scss.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  if (isBare(pathname)) {
    return <div className={appStyles.app}>{children}</div>
  }

  return (
    <div className={styles.shell}>
      <DesktopHeader />
      <MobileHeader />
      <main data-width={contentWidthFor(pathname)} className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>IozyPlay · version {VERSION}</footer>
      <TabBar />
    </div>
  )
}
