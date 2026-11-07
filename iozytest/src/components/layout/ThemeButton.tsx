import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import styles from '@/components/layout/AppShell.module.scss'

/** Le thème vit sur <html> (classe posée par settingsService) : on l'observe
 *  là plutôt que de dupliquer un état, pour que le bouton de l'en-tête et la
 *  page Réglages ne se contredisent jamais. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function isLightTheme(): boolean {
  return document.documentElement.classList.contains('light-theme')
}

/**
 * Clair ou sombre, en un clic, depuis l'en-tête (le thème se change selon la
 * lumière de la pièce, pas une fois pour toutes dans les réglages).
 * L'icône montre le mode COURANT ; le nom accessible dit l'ACTION.
 */
export default function ThemeButton() {
  const light = useSyncExternalStore(subscribe, isLightTheme, () => false)
  const action = light ? 'Passer en thème sombre' : 'Passer en thème clair'
  const Icon = light ? Sun : Moon

  return (
    <button
      type="button"
      className={styles.iconBtn}
      title={action}
      aria-label={action}
      onClick={() => settingsService.updateSetting('theme', light ? 'dark' : 'light')}
    >
      <Icon size={17} />
    </button>
  )
}
