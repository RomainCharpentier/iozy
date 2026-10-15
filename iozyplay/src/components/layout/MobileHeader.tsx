import Wordmark from '@/components/layout/Wordmark'
import HeaderShortcuts from '@/components/layout/HeaderShortcuts'
import styles from '@/components/layout/AppShell.module.scss'

/** En-tête mobile (< 768 px), réduit à ce que la barre au pouce ne porte pas :
 *  le nom de l'app et les raccourcis. Pas de menu global. */
export default function MobileHeader() {
  return (
    <header className={`${styles.mobileHeader} ${styles.glass}`}>
      <Wordmark />
      <HeaderShortcuts />
    </header>
  )
}
