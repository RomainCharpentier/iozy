import { Link, useLocation } from 'react-router-dom'
import { GlobalShortcuts } from './GlobalShortcuts'
import { NAV_ITEMS, type NavItem } from './navItems'

function NavLinkItem({ to, label, icon: Icon, activeWhen }: NavItem) {
  const { pathname } = useLocation()
  const active = activeWhen(pathname)
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

/** Navigation desktop (>= 768px, voir AppShell.NAV_BREAKPOINT) - les quatre
 * destinations de NAV_ITEMS, la même liste que la barre du pouce. Envies
 * (cœur, avec badge) et Profil (avatar) restent des raccourcis séparés,
 * jamais des destinations pairs : les Envies sont une lecture de Ma
 * collection (étude produit du 2026-08-27, §16). */
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
          {NAV_ITEMS.map((item) => (
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
