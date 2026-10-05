import { Compass, Library, Search } from 'lucide-react'

export interface NavItem {
  to: string
  /** The full label, the one of the desktop bar. */
  label: string
  /** What the thumb bar displays - the same word when it fits, a shorter
   *  word otherwise. Four tabs on 375 px leave no room
   *  to write "Analyser une annonce". */
  labelCourt: string

  icon: typeof Library
  /** Additional routes that must also light up this entry - e.g. the detail
   *  page of a series stays under "Ma collection", the analysis history
   *  under "Analyser une annonce". `NavLink` alone can only compare a
   *  route prefix. */
  activeWhen: (pathname: string) => boolean
}

/**
 * The global destinations of the application - **a single list**, read by the
 * desktop bar and by the thumb bar.
 *
 * <h2>Why it lives here and no longer in each bar</h2>
 * The two bars each carried their copy, "manually kept
 * in sync": which is a guarantee to diverge. Adding a fourth
 * entry to one and not to the other would have made a whole flow
 * unreachable with a thumb - exactly what had already happened to the Wishes and
 * the Profile (see GlobalShortcuts).
 *
 * <h2>Three entries, and none names a universe (batch 137)</h2>
 * "Analyser une annonce" was the fourth, from 2026-08-27 to 2026-09-05:
 * an independent flow, which starts with a listing URL and creates neither
 * ownership nor wish. But it is a MANGA flow - a lot of used
 * volumes compared to the collection - and the navigation bar applies to
 * any collection, like Ma collection since batch 136. It is now
 * reached from Discover (link card at the top) and from the detail page
 * of a series ("Évaluer une annonce"), and it is Discover that lights up
 * when you are there.
 *
 * <p>The Wishes are not there: they are a reading of Ma collection, not a
 * destination (§16, closed decision).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Ma collection',
    labelCourt: 'Collection',
    icon: Library,
    activeWhen: (p) => p === '/' || p.startsWith('/entity/') || p.startsWith('/collection/'),
  },
  {
    to: '/add',
    // "Catalogue" and not "Rechercher": the tab no longer leads to an empty
    // page that an input fills, it shows the works that the instance knows.
    // Searching at a provider is still possible there - it became the second
    // half of the screen, not its reason for being. It is also the only
    // destination of a visitor, to whom "Rechercher" would have promised nothing.
    label: 'Catalogue',
    labelCourt: 'Catalogue',
    icon: Search,
    // `/scan` stays under Rechercher: scanning is identifying a work -
    // the same pipeline, another input.
    activeWhen: (p) => p === '/add' || p === '/scan' || p === '/apercu',
  },
  {
    to: '/discover',
    label: 'Découvrir',
    labelCourt: 'Découvrir',
    icon: Compass,
    // The Tier Lists, the purchase suggestions, the release calendar and
    // the analysis of a listing open from Discover and from nowhere
    // else in the navigation: it is the one that stays lit when you are there.
    activeWhen: (p) =>
      p.startsWith('/discover') ||
      p.startsWith('/tier-lists') ||
      p.startsWith('/releases') ||
      p.startsWith('/suggestions') ||
      p.startsWith('/purchase-analysis'),
  },
]
