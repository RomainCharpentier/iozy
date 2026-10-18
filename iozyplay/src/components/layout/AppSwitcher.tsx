import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import iozycoreMark from 'iozykit/brand/iozycore.svg'
import iozyplayMark from 'iozykit/brand/iozyplay.svg'
import Wordmark from '@/components/layout/Wordmark'
import styles from '@/components/layout/AppShell.module.scss'

/**
 * La marque de l'en-tête ouvre les autres apps Iozy : cette app, IozyCore, et un dernier
 * lien vers la page d'accueil du site, qui montre toutes les apps. Seulement quand l'app vit sous son préfixe (/play, à côté des
 * autres) ; seule à la racine (dev, Vercel), la marque reste un simple lien
 * vers l'accueil et rien de tout ceci n'existe.
 *
 * Un <details>, donc ouverture et fermeture sans script ; l'effet ne fait que
 * fermer au clic ailleurs ou sur Échap. Les styles sont ceux de la charte
 * (`.iozy-apps`, iozykit/css/components.css), les mêmes dans IozyCore.
 */
export default function AppSwitcher() {
  const details = useRef<HTMLDetailsElement>(null)
  const standalone = import.meta.env.BASE_URL === '/'

  useEffect(() => {
    if (standalone) return
    function close(event: MouseEvent | KeyboardEvent) {
      const element = details.current
      if (!element?.open) return
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !element.contains(event.target as Node)) {
        element.open = false
      }
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', close)
    }
  }, [standalone])

  if (standalone) return <Wordmark />

  return (
    <details ref={details} className="iozy-apps">
      <summary className={styles.wordmark}>
        Iozy<span className={styles.wordmarkAccent}>Play</span>
        <ChevronDown className="iozy-apps__chevron" aria-hidden />
      </summary>
      <nav className="iozy-apps__menu" aria-label="Les apps Iozy">
        <a className="iozy-apps__app" href="/core/">
          <img src={iozycoreMark} alt="" />
          <span>
            <b>
              Iozy<span className={styles.wordmarkAccent}>Core</span>
            </b>
            <small>Ta collection</small>
          </span>
        </a>
        <a className="iozy-apps__app" href={import.meta.env.BASE_URL} aria-current="page">
          <img src={iozyplayMark} alt="" />
          <span>
            <b>
              Iozy<span className={styles.wordmarkAccent}>Play</span>
            </b>
            <small>Le blindtest</small>
          </span>
        </a>
        <a className="iozy-apps__app iozy-apps__accueil" href="/">
          Voir toutes les apps
        </a>
      </nav>
    </details>
  )
}
