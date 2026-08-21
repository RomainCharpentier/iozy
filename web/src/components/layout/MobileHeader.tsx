import { Link } from 'react-router-dom'
import { GlobalShortcuts } from './GlobalShortcuts'

/**
 * En-tête mobile (< 768px, voir AppShell.NAV_BREAKPOINT_PX) - volontairement
 * réduit à ce que la barre du pouce ne peut pas porter : le nom de l'app, les
 * Envies et le Profil.
 * <p>
 * La navigation globale reste STRICTEMENT à trois destinations
 * (Collection / Rechercher / Découvrir, voir TabBar) : Envies et Profil ne sont
 * pas des destinations pairs et n'ont donc rien à faire dans la barre basse.
 * Mais faute de tout en-tête en mobile, ils n'étaient accessibles nulle part -
 * et avec eux disparaissaient Paramètres, Administration, l'export, le bilan
 * annuel et les deux liens de partage (voir docs/USER_JOURNEYS.md §12.1).
 * <p>
 * Pas de menu global ici : cet en-tête ne doit jamais devenir le tiroir
 * fourre-tout de toutes les fonctionnalités. Chaque outil reste dans l'espace
 * auquel il appartient.
 */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-surface2 bg-surface md:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link to="/" className="font-display text-base font-bold text-textPrimary">
          IozyCore
        </Link>
        <div className="ml-auto">
          <GlobalShortcuts compact />
        </div>
      </div>
    </header>
  )
}
