import { Link } from 'react-router-dom'
import { GlobalShortcuts } from './GlobalShortcuts'

/**
 * The top of the screen under 1024 px: the brand and the shortcuts (theme,
 * administration, exit, avatar), which the thumb bar does not carry. The
 * destinations and the search live in the thumb bar (see BarreOnglets).
 */
export function EnTeteMobile() {
  return (
    <header className="flex items-center gap-3 px-4 pt-3 lg:hidden">
      <Link to="/" className="iozy-verre iozy-barre__pilule iozy-barre__marque !mr-0 !px-5" aria-label="Iozy, accueil">
        Iozy
      </Link>
      <div className="ml-auto">
        <GlobalShortcuts compact />
      </div>
    </header>
  )
}
