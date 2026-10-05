import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/common/lib/theme'

/**
 * Light or dark, in one click, from the header.
 *
 * <h2>Why here, and no longer in the Settings</h2>
 * The switch lived under Settings ▸ "Cet appareil", three clicks away from
 * any screen (avatar, Profile, Settings) - for an action you do
 * depending on the light in the room, not a setting you set once. Requested
 * by the user (batch 138): "just an icon that changes with the mode".
 *
 * <h2>An icon, like its neighbors</h2>
 * It shows the CURRENT mode - the moon when it is dark, the sun when
 * it is light - which is what the switch in the Settings already showed, and what
 * "changes with the mode" means. The accessible name, for its part, names
 * the ACTION ("Passer en thème clair"): a button says what it does, and a
 * screen reader does not have the icon to guess the rest. Carried by
 * `aria-label` AND `title`, like Administration and the exit.
 *
 * <p>For everyone, visitors included: the theme is a setting of the
 * device, not of the account (see lib/theme, localStorage).
 */
export function BoutonTheme({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const taille = compact ? 'h-11 w-11' : 'h-10 w-10'
  const action = theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'
  const Icone = theme === 'dark' ? Moon : Sun

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={action}
      aria-label={action}
      className={`flex ${taille} shrink-0 items-center justify-center rounded-xl text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary`}
    >
      <Icone size={17} />
    </button>
  )
}
