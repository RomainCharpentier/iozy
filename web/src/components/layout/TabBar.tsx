import { NavLink } from 'react-router-dom'
import { LayoutGrid, Search, User, Settings } from 'lucide-react'

interface TabDef {
  to: string
  label: string
  icon: typeof LayoutGrid
  end?: boolean
}

// 4 onglets pensés par parcours utilisateur plutôt qu'un onglet par
// fonctionnalité (voir discussion "trop de menus/sous-menus") :
// - consulter ma collection (Ma collection)
// - chercher un titre à ajouter, dans les catalogues externes
//   (Rechercher - pointe vers QuickAddPage : l'écran est d'abord une
//   recherche avec suggestions/jaquettes, l'ajout n'est que le bouton final,
//   d'où le libellé "Rechercher" plutôt que "Ajouter")
// - tout le reste, consulté ponctuellement (Mon profil : Wishlist/Stats/
//   Types/Évaluer un achat, voir ProfilePage.tsx - pas de bouton flottant :
//   un FAB signale universellement "créer du nouveau", l'utiliser pour
//   "Évaluer un achat" n'était pas intuitif)
// - configuration de l'app (Paramètres)
// Décalage (temporaire, assumé) avec RootTabView côté iOS, pas encore mis à jour.
const TABS: TabDef[] = [
  { to: '/', label: 'Ma collection', icon: LayoutGrid, end: true },
  { to: '/add', label: 'Rechercher', icon: Search },
  { to: '/profile', label: 'Mon profil', icon: User },
  { to: '/settings', label: 'Paramètres', icon: Settings },
]

// md:hidden : bascule vers DesktopHeader à partir de 768px (voir
// AppShell.NAV_BREAKPOINT) - une barre d'onglets texte+icône empilés en bas
// d'écran est un pattern mobile, jamais un pattern desktop. Se cache elle-même
// via CSS plutôt que de dépendre d'un parent conditionnel : garantit qu'elle
// et DesktopHeader ne sont jamais visibles toutes les deux à la fois, quel
// que soit l'ordre d'hydratation.
export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-surface2 bg-surface md:hidden">
      <ul className="mx-auto flex max-w-2xl justify-around">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                  isActive ? 'text-accent' : 'text-textDim'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
