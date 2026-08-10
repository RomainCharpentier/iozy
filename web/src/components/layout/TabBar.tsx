import { NavLink } from 'react-router-dom'
import { LayoutGrid, Search, User, Settings } from 'lucide-react'

interface TabDef {
  to: string
  label: string
  icon: typeof LayoutGrid
  end?: boolean
}

// Réorganisation à 4 onglets pensée par parcours utilisateur plutôt qu'un
// onglet par fonctionnalité (voir discussion "trop de menus/sous-menus") :
// - consulter ma collection (Ma collection)
// - trouver quelque chose dans ma collection (Rechercher)
// - tout le reste, consulté ponctuellement plutôt qu'à chaque session
//   (Mon profil : Wishlist/Stats/Types, voir ProfilePage.tsx)
// - configuration de l'app (Paramètres)
// "Ajouter"/"Évaluer un achat" n'ont plus d'onglet dédié : ce sont les deux
// mêmes parcours d'acquisition, désormais centralisés dans le bouton
// flottant "+" (voir FloatingAddButton.tsx), accessible depuis tout écran.
// Décalage (temporaire, assumé) avec RootTabView côté iOS, pas encore mis à jour.
const TABS: TabDef[] = [
  { to: '/', label: 'Ma collection', icon: LayoutGrid, end: true },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/profile', label: 'Mon profil', icon: User },
  { to: '/settings', label: 'Paramètres', icon: Settings },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-surface2 bg-surface">
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
