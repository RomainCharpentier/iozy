import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

// Cluster gauche : parcours principal (même 3 premiers repères qu'en mobile,
// voir TabBar - "Rechercher" pointe vers QuickAddPage, Wishlist existe comme
// route propre même si repliée sous "Mon profil" sur mobile faute de place).
const PRIMARY: NavItem[] = [
  { to: '/', label: 'Ma collection', end: true },
  { to: '/add', label: 'Rechercher' },
  { to: '/wishlist', label: 'Wishlist' },
]

// Cluster droit : compte/config, séparé visuellement (voir la maquette) sans
// construire un vrai menu déroulant - juste des liens directs, inutile ici
// (2 destinations seulement, TabBar les couvre déjà côté mobile).
const SECONDARY: NavItem[] = [
  { to: '/profile', label: 'Mon profil' },
  { to: '/settings', label: 'Paramètres' },
]

function NavLinkItem({ to, label, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex h-full items-center border-b-2 text-sm font-medium transition-colors ${
          isActive ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-textPrimary'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

/** Navigation desktop (>= 768px, voir AppShell.NAV_BREAKPOINT) - remplace la
 * TabBar mobile plutôt que de l'agrandir : une barre d'onglets texte+icône
 * empilés en bas d'écran est un pattern mobile, jamais un pattern desktop
 * (voir la refonte layout demandée). Sticky (reste visible au scroll) plutôt
 * que fixed : participe au flux normal du document, AppShell n'a donc pas
 * besoin de padding-top compensatoire comme il lui en faut pour la TabBar
 * fixed en bas (voir AppShell.tsx). Hauteur fixe (h-16 = 64px) : ne bouge
 * jamais avec l'état actif (bordure transparente par défaut, jamais absente). */
export function DesktopHeader() {
  return (
    <header className="sticky top-0 z-10 hidden h-16 shrink-0 border-b border-surface2 bg-surface md:block">
      <div className="mx-auto flex h-full w-[min(100%-48px,1600px)] items-center gap-8">
        <NavLink to="/" className="font-display text-lg font-bold text-textPrimary">
          IozyCore
        </NavLink>
        <nav className="flex h-full items-center gap-6">
          {PRIMARY.map((item) => (
            <NavLinkItem key={item.to} {...item} />
          ))}
        </nav>
        <nav className="ml-auto flex h-full items-center gap-6">
          {SECONDARY.map((item) => (
            <NavLinkItem key={item.to} {...item} />
          ))}
        </nav>
      </div>
    </header>
  )
}
