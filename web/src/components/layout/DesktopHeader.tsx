import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Compass, Heart, Library, Search } from 'lucide-react'
import { useWishlist } from '../../lib/useWishlist'

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
    <NavLink
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-[46px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
        active ? 'bg-accentTint text-accentText' : 'text-textDim hover:bg-rowHover'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.15 : 1.75} />
      {label}
      {active && <span className="absolute inset-x-4 -bottom-2.5 h-0.5 rounded-full bg-accent" />}
    </NavLink>
  )
}

/** Navigation desktop (>= 768px, voir AppShell.NAV_BREAKPOINT) - source
 * unique à 3 destinations (voir PRIMARY), partagée conceptuellement avec
 * TabBar (même 3 entrées, même ordre - voir la maquette V1.2 "navItems").
 * Envies (Heart, avec badge) et Profil (avatar) restent des raccourcis
 * séparés, jamais des destinations de nav pairs (voir §9-11 du brief). */
export function DesktopHeader() {
  const navigate = useNavigate()
  const { count: wishlistCount } = useWishlist()

  return (
    <header className="sticky top-0 z-10 hidden h-16 shrink-0 border-b border-surface2 bg-surface md:block">
      <div className="mx-auto flex h-full w-[min(100%-48px,1600px)] items-center gap-6">
        <Link to="/" className="font-display text-lg font-bold text-textPrimary">
          IozyCore
        </Link>
        <nav className="flex h-full items-center gap-1.5">
          {PRIMARY.map((item) => (
            <NavLinkItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/wishlist')}
            title="Mes envies"
            aria-label={wishlistCount > 0 ? `Mes envies, ${wishlistCount}` : 'Mes envies'}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary"
          >
            <Heart size={20} />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentInk">
                {wishlistCount}
              </span>
            )}
          </button>
          <Link
            to="/profile"
            title="Mon profil"
            aria-label="Mon profil"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface2 to-accentTint font-display text-xs font-bold text-textPrimary"
          >
            IO
          </Link>
        </div>
      </div>
    </header>
  )
}
