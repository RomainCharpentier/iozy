import { AppSwitcher } from './AppSwitcher'
import { GlobalShortcuts } from './GlobalShortcuts'

/**
 * The top of the screen under 1024 px: the brand and the shortcuts (theme,
 * administration, exit, avatar), which the thumb bar does not carry. The
 * destinations and the search live in the thumb bar (see BarreOnglets).
 */
export function EnTeteMobile() {
  return (
    <header className="relative z-40 flex items-center gap-3 px-4 pt-3 lg:hidden">
      {/* The brand opens the other Iozy apps (lot 234): IozyTest is a neighbour, no longer a button here. */}
      <div className="iozy-verre iozy-barre__pilule !mr-0 !px-5">
        <AppSwitcher compact />
      </div>
      <div className="ml-auto">
        <GlobalShortcuts compact />
      </div>
    </header>
  )
}
