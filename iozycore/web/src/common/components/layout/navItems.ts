import { CalendarDays, Gamepad2, House, Share2, ShoppingBag, type LucideIcon } from 'lucide-react'
import { estReserveeAuxComptes } from '@/common/lib/accesInvite'

export interface NavItem {
  /** A stable key: two entries may point at the same screen for now. */
  cle: string
  /** A route of this app (router link), or… */
  to?: string
  /** …an address of another app of the site (plain link, full page load). */
  href?: string
  /** Router state passed with `to` (e.g. focus the sharing on the profile). */
  state?: Record<string, unknown>
  /** The full label, the one of the desktop bar. */
  label: string
  /** What the thumb bar displays - the same word when it fits. */
  labelCourt: string
  icon: LucideIcon
  /** The routes that light this entry. `NavLink` alone can only compare a prefix. */
  activeWhen: (pathname: string) => boolean
}

/**
 * The global destinations of the site - **a single list**, read by the top
 * bar and by the thumb bar.
 *
 * <h2>The five intentions of the redesign (lot 210)</h2>
 * Accueil, Sorties, À acheter, Partager, and the other app, IozyTest: the
 * owner's four goals (follow the collections, see the releases, manage the
 * purchases, share) plus the game. Searching and adding are not a tab any
 * more: they live in the "Chercher ou ajouter" field of the bar.
 *
 * <h2>Two entries point at screens that will move</h2>
 * "À acheter" leads to the purchase analysis and "Partager" to the sharing
 * section of the profile, where the share link is managed today. Their own
 * pages come in later lots, which only change `to` here.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    cle: 'accueil',
    to: '/',
    label: 'Accueil',
    labelCourt: 'Accueil',
    icon: House,
    activeWhen: (p) => p === '/' || p === '/collection' || p.startsWith('/entity/') || p.startsWith('/collection/'),
  },
  {
    cle: 'sorties',
    to: '/releases',
    label: 'Sorties',
    labelCourt: 'Sorties',
    icon: CalendarDays,
    activeWhen: (p) => p.startsWith('/releases'),
  },
  {
    cle: 'acheter',
    to: '/purchase-analysis',
    label: 'À acheter',
    labelCourt: 'À acheter',
    icon: ShoppingBag,
    activeWhen: (p) => p.startsWith('/purchase-analysis'),
  },
  {
    cle: 'partager',
    to: '/profile',
    state: { focusPartage: true },
    label: 'Partager',
    labelCourt: 'Partager',
    icon: Share2,
    // The profile itself is lit by the avatar: lighting "Partager" there too
    // would name two places for one screen.
    activeWhen: () => false,
  },
  {
    cle: 'iozytest',
    href: '/test/',
    label: 'IozyTest',
    labelCourt: 'IozyTest',
    icon: Gamepad2,
    activeWhen: () => false,
  },
]

/**
 * The destinations one bar shows, read by both bars.
 *
 * <p>During a visit without an account, only the destinations that do not
 * need an account remain (see lib/accesInvite): a tab that bounces back
 * informs nobody. The other app stays, it has no account wall.
 */
export function destinationsPour(estInvite: boolean): NavItem[] {
  if (!estInvite) return NAV_ITEMS
  return NAV_ITEMS.filter((item) => !item.to || !estReserveeAuxComptes(item.to))
}
