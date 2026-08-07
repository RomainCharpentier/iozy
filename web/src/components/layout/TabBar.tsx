import { NavLink } from 'react-router-dom'
import { LayoutGrid, Search, PlusCircle, Star, BarChart3, Languages } from 'lucide-react'

interface TabDef {
  to: string
  label: string
  icon: typeof LayoutGrid
  end?: boolean
}

// Même ordre que RootTabView dans IozyCoreApp.swift.
const TABS: TabDef[] = [
  { to: '/', label: 'Étagères', icon: LayoutGrid, end: true },
  { to: '/search', label: 'Recherche', icon: Search },
  { to: '/add', label: 'Ajouter', icon: PlusCircle },
  { to: '/wishlist', label: 'Wishlist', icon: Star },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Réglages', icon: Languages },
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
