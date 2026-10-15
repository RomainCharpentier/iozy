import { PenLine, Play, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Les routes qui allument aussi cette entrée (la page des thèmes et le
   *  salon restent sous « Jouer ») : `NavLink` seul ne compare qu'un préfixe. */
  activeWhen: (pathname: string) => boolean
}

/**
 * Les destinations globales de l'app — UNE seule liste, lue par la barre de
 * bureau et par la barre d'onglets mobile (même principe qu'IozyCore : deux
 * copies « tenues à jour à la main » finissent toujours par diverger).
 *
 * Deux entrées : ce qu'on fait avec l'app (jouer) et ce qui la nourrit
 * (l'éditeur). Les réglages et le thème ne sont pas des destinations, ce sont
 * des raccourcis de l'en-tête.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Jouer',
    icon: Play,
    activeWhen: (p) => p === '/' || p.startsWith('/categories') || p.startsWith('/room'),
  },
  {
    to: '/editor',
    label: 'Éditeur',
    icon: PenLine,
    activeWhen: (p) => p.startsWith('/editor'),
  },
]

/** Le libellé de la destination qui contient `pathname` — pour un lien retour
 *  qui NOMME où il mène, jamais « Retour » tout court. */
export function destinationLabelFor(pathname: string | undefined): { to: string; label: string } {
  if (pathname?.startsWith('/settings')) return { to: '/settings', label: 'Réglages' }
  const item = pathname ? NAV_ITEMS.find((i) => i.activeWhen(pathname)) : undefined
  return item ? { to: item.to, label: item.label } : { to: '/', label: 'Jouer' }
}
