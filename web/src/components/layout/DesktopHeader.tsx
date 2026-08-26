import { Link, useLocation } from 'react-router-dom'
import { Compass, Library, Search } from 'lucide-react'
import { GlobalShortcuts } from './GlobalShortcuts'

interface NavItem {
  to: string
  label: string
  icon: typeof Library
  /** Routes additionnelles qui doivent aussi allumer cet onglet (voir la
   * maquette V1.2, `navItems[].screens`) - ex: la fiche d'une série reste
   * sous "Ma collection", une page d'historique d'analyse reste sous
   * "Rechercher". `NavLink` seul ne sait comparer qu'un préfixe de route. */
  activeWhen?: (pathname: string) => boolean
}

// Trois destinations globales, jamais plus (voir la maquette V1.2 - "Trois
// intentions, trois espaces. Tout le reste vit dans l'espace auquel il
// appartient : Envies au cœur [Heart ci-dessous], Profil à l'avatar, outils
// dans leur contexte" - ni Wishlist ni Paramètres n'y figurent plus, voir
// docs/DESIGN_MIGRATION_V1.2.md Lot 2).
const PRIMARY: NavItem[] = [
  { to: '/', label: 'Ma collection', icon: Library, activeWhen: (p) => p === '/' || p.startsWith('/entity/') },
  {
    to: '/add',
    label: 'Rechercher',
    icon: Search,
    activeWhen: (p) => p === '/add' || p === '/scan' || p.startsWith('/purchase-analysis'),
  },
  { to: '/discover', label: 'Découvrir', icon: Compass, activeWhen: (p) => p.startsWith('/discover') },
]

function NavLinkItem({ to, label, icon: Icon, activeWhen }: NavItem) {
  const { pathname } = useLocation()
  const active = activeWhen ? activeWhen(pathname) : pathname === to
  return (
  // `Link` et non `NavLink` : React Router recalcule lui-même `aria-current`
  // à partir de SA correspondance de route (exacte pour `to="/"`) et écrase
  // celui qu'on lui passe. Résultat mesuré : sur la fiche d'une œuvre, « Ma
  // collection » était bien peinte en destination courante par `activeWhen`
  // mais n'annonçait plus rien - la même incohérence sur `/scan` et
  // `/purchase-analysis` sous « Rechercher ». On calcule déjà `active`
  // nous-mêmes ; il ne reste qu'à ne pas laisser NavLink le contredire.
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      // La destination courante est une pastille SURLEVEE (surface + ombre),
      // pas un aplat teinté doublé d'un trait (maquette v4) : deux signaux
      // pour la même information, dont l'un - le trait accroché à -10px -
      // débordait de l'en-tête.
      className={`flex h-[46px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors ${
        active ? 'bg-surface font-semibold text-textPrimary shadow-token-sm' : 'text-textDim hover:bg-rowHover'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.15 : 1.75} />
      {label}
    </Link>
  )
}

/** Navigation desktop (>= 768px, voir AppShell.NAV_BREAKPOINT) - source
 * unique à 3 destinations (voir PRIMARY), partagée conceptuellement avec
 * TabBar (même 3 entrées, même ordre - voir la maquette V1.2 "navItems").
 * Envies (Heart, avec badge) et Profil (avatar) restent des raccourcis
 * séparés, jamais des destinations de nav pairs (voir §9-11 du brief). */
export function DesktopHeader() {

  return (
    <header className="sticky top-0 z-10 hidden h-16 shrink-0 border-b border-line bg-surface2 md:block">
      <div className="mx-auto flex h-full w-[min(100%-48px,1600px)] items-center gap-6">
        {/* « Iozy » en encre, « core » en accent (maquette v4) : la marque
            porte l'accent dans son propre nom, elle n'a pas besoin d'un bloc
            coloré autour. */}
        <Link to="/" className="font-display text-lg font-semibold tracking-[-0.02em] text-textPrimary">
          Iozy<span className="text-accent">core</span>
        </Link>
        <nav className="flex h-full items-center gap-1.5">
          {PRIMARY.map((item) => (
            <NavLinkItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="ml-auto">
          <GlobalShortcuts />
        </div>
      </div>
    </header>
  )
}
