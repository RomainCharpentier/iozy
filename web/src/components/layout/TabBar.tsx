import { NavLink } from 'react-router-dom'
import { LayoutGrid, PlusCircle, User, Settings } from 'lucide-react'

interface TabDef {
  to: string
  label: string
  icon: typeof LayoutGrid
  end?: boolean
}

// 4 onglets pensés par parcours utilisateur plutôt qu'un onglet par
// fonctionnalité (voir discussion "trop de menus/sous-menus") :
// - consulter ma collection (Ma collection)
// - en faire entrer du nouveau, recherche externe/globale incluse (Ajouter -
//   remplace l'ancien onglet "Rechercher", qui ne fouillait QUE dans ce
//   qu'on possédait déjà et faisait doublon avec la vraie recherche
//   utile ici : "est-ce que ce titre existe, l'ai-je déjà ?")
// - tout le reste, consulté ponctuellement (Mon profil : Wishlist/Stats/
//   Types, voir ProfilePage.tsx)
// - configuration de l'app (Paramètres)
// "Évaluer un achat" garde son bouton flottant dédié (voir
// FloatingAddButton.tsx) - Ajouter ayant maintenant son propre onglet, le
// menu du bouton flottant n'a plus besoin de proposer les deux.
// Décalage (temporaire, assumé) avec RootTabView côté iOS, pas encore mis à jour.
const TABS: TabDef[] = [
  { to: '/', label: 'Ma collection', icon: LayoutGrid, end: true },
  { to: '/add', label: 'Ajouter', icon: PlusCircle },
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
