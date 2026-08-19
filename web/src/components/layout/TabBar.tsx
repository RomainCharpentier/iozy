import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Compass, Library, ScanLine, Search } from 'lucide-react'

interface TabDef {
  to: string
  label: string
  icon: typeof Library
  activeWhen?: (pathname: string) => boolean
}

// Même 3 destinations et même ordre que DesktopHeader.PRIMARY (voir la
// maquette V1.2 - une seule source de vérité conceptuelle "navItems",
// dupliquée ici faute de contexte de nav partagé dans ce repo, mais gardée
// manuellement synchronisée). Envies et Profil ne sont plus dans la barre
// du pouce (voir §12 - accès via Heart/avatar dans le header, repris eux
// aussi seulement au clic sur "Mon profil" plus bas dans le contenu si
// besoin) : ce n'était déjà plus tout à fait le cas avant ce lot (Wishlist
// vivait sous Profil), mais Paramètres quittait aussi la barre - déplacé en
// entrée dans ProfilePage (voir ce fichier).
const TABS: TabDef[] = [
  { to: '/', label: 'Collection', icon: Library, activeWhen: (p) => p === '/' || p.startsWith('/entity/') },
  {
    to: '/add',
    label: 'Rechercher',
    icon: Search,
    activeWhen: (p) => p === '/add' || p === '/scan' || p.startsWith('/purchase-analysis'),
  },
  { to: '/discover', label: 'Découvrir', icon: Compass, activeWhen: (p) => p.startsWith('/discover') },
]

/** Barre du pouce (< 768px, voir AppShell.NAV_BREAKPOINT) - remplacée par
 * DesktopHeader au-delà. 3 destinations + raccourci Scan intégré (voir la
 * maquette V1.2, "Nav pouce : 3 espaces, plus le scan au centre") : le FAB
 * Scan n'est PAS une 4e destination pair (pas d'aria-current, séparé par une
 * bordure) - juste un raccourci une-main vers un point d'entrée déjà couvert
 * par Rechercher, cohérent avec "ne pas dupliquer le pipeline
 * d'identification" (voir §26/§29). */
export function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-1 border-t border-surface2 bg-surface px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
      {TABS.map(({ to, label, icon: Icon, activeWhen }) => {
        const active = activeWhen ? activeWhen(pathname) : pathname === to
        return (
          <NavLink
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className="flex min-w-0 flex-1 items-stretch justify-center"
          >
            <span
              className={`flex min-h-[54px] w-full max-w-[84px] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-colors ${
                active ? 'bg-accentTint text-accentText' : 'text-textDim'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.15 : 1.75} />
              {label}
            </span>
          </NavLink>
        )
      })}
      <span className="my-2 w-px shrink-0 bg-surface2" aria-hidden="true" />
      <button
        type="button"
        onClick={() => navigate('/scan')}
        title="Scanner un code-barres"
        className="my-1 flex min-h-[46px] w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-accent text-accentText shadow-token-accent active:translate-y-0.5"
      >
        <ScanLine size={20} strokeWidth={2} />
        <span className="text-[9px] font-bold tracking-wide uppercase">Scan</span>
      </button>
    </nav>
  )
}
