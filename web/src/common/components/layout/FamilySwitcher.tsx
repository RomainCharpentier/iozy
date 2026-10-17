import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import iozycoreMark from 'iozykit/brand/iozycore.svg'
import iozyplayMark from 'iozykit/brand/iozyplay.svg'

/**
 * The brand in the header opens the family: this app, IozyPlay, and the home
 * of the site. Only when the app lives under a prefix (/core/ next to the
 * others): alone at the root (dev, the e2e stack), the brand stays a link to
 * the home of the app, and nothing here exists.
 *
 * <p>A <details>, so the menu opens and closes without a script; the effect
 * only closes it on a click elsewhere or on Escape. The styles are the
 * charter's (`.iozy-famille`, iozykit/css/components.css), the same in
 * IozyPlay.
 */
export function FamilySwitcher({ compact = false }: { compact?: boolean }) {
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

  // "Iozy" in ink, "core" in accent (mockup v4): the brand carries the
  // accent in its own name, it does not need a colored block around it.
  const wordmark = (
    <>
      Iozy<span className="text-accent">core</span>
    </>
  )
  const classes = `flex h-full items-center font-display font-semibold tracking-[-0.02em] text-textPrimary ${compact ? 'text-base' : 'text-lg'}`

  if (standalone) {
    return (
      <Link to="/" className={classes}>
        {wordmark}
      </Link>
    )
  }

  return (
    <details ref={details} className="iozy-famille">
      <summary className={classes}>
        {wordmark}
        <ChevronDown className="iozy-famille__chevron" aria-hidden />
      </summary>
      <nav className="iozy-famille__menu" aria-label="La famille Iozy">
        <a className="iozy-famille__app" href={import.meta.env.BASE_URL} aria-current="page">
          <img src={iozycoreMark} alt="" />
          <span>
            <b>
              Iozy<span className="text-accent">core</span>
            </b>
            <small>Ta collection</small>
          </span>
        </a>
        <a className="iozy-famille__app" href="/play/">
          <img src={iozyplayMark} alt="" />
          <span>
            <b>
              Iozy<span className="text-accent">Play</span>
            </b>
            <small>Le blindtest</small>
          </span>
        </a>
        <a className="iozy-famille__app iozy-famille__accueil" href="/">
          Toute la famille
        </a>
      </nav>
    </details>
  )
}
