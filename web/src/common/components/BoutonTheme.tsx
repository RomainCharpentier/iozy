import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/common/lib/theme'

/**
 * Clair ou sombre, d'un clic, depuis l'en-tête.
 *
 * <h2>Pourquoi ici, et plus dans les Paramètres</h2>
 * L'interrupteur vivait sous Paramètres ▸ « Cet appareil », à trois clics de
 * n'importe quel écran (avatar, Profil, Paramètres) - pour un geste qu'on fait
 * selon la lumière de la pièce, pas un réglage qu'on pose une fois. Demandé
 * par l'utilisateur (lot 138) : « juste une icône qui change selon le mode ».
 *
 * <h2>Une icône, comme ses voisines</h2>
 * Elle montre le mode COURANT - la lune quand il fait sombre, le soleil quand
 * il fait clair - ce que l'interrupteur des Paramètres montrait déjà, et ce
 * que « change selon le mode » veut dire. Le nom accessible, lui, nomme
 * l'ACTION (« Passer en thème clair ») : un bouton dit ce qu'il fait, et un
 * lecteur d'écran n'a pas l'icône pour deviner le reste. Porté par
 * `aria-label` ET `title`, comme Administration et la sortie.
 *
 * <p>Pour tout le monde, visiteur compris : le thème est un réglage de
 * l'appareil, pas du compte (voir lib/theme, localStorage).
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
