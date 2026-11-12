import { Gamepad2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GlobalShortcuts } from './GlobalShortcuts'

/**
 * The top of the screen under 1024 px: the brand and the shortcuts (theme,
 * administration, exit, avatar), which the thumb bar does not carry. The
 * destinations and the search live in the thumb bar (see BarreOnglets).
 */
export function EnTeteMobile() {
  return (
    <header className="relative z-40 flex items-center gap-3 px-4 pt-3 lg:hidden">
      <Link to="/" className="iozy-verre iozy-barre__pilule iozy-barre__marque !mr-0 !px-5" aria-label="Iozy, accueil">
        Iozy
      </Link>
      <a href="/test/" aria-label="IozyTest" className="iozy-verre ml-auto flex h-11 w-11 items-center justify-center rounded-full text-textPrimary">
        <Gamepad2 size={20} aria-hidden="true" />
      </a>
      <div>
        <GlobalShortcuts compact />
      </div>
    </header>
  )
}
