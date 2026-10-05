import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, ListOrdered, PartyPopper, Scale, Sparkles, Telescope } from 'lucide-react'
import { DiscoverTierPreview } from './DiscoverTierPreview'
import { DiscoverOpportunitiesPreview } from './DiscoverOpportunitiesPreview'
import { DiscoverySection } from './DiscoverySection'
import { DiscoverReleasesPreview } from './DiscoverReleasesPreview'
import { EnTeteSection } from '@/common/components/EnTeteSection'

type DiscoverTab = 'tiers' | 'opps' | 'decouvertes' | 'sorties'

const TABS: { id: DiscoverTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'tiers', label: 'Tier Lists', icon: ListOrdered },
  { id: 'opps', label: 'Opportunités', icon: Sparkles },
  { id: 'decouvertes', label: 'Découvertes', icon: Telescope },
  { id: 'sorties', label: 'Sorties', icon: CalendarDays },
]

/** Under 1100px (mobile or narrow desktop): 4 sub-tabs, only one panel
 * visible at a time (role="tab"/aria-selected - the only set of tabs of
 * the application). From 1100px on desktop: real editorial
 * composition - Tier Lists on ~62%, Opportunités next to it (separating
 * border), Découvertes full width below - no more tabs at this
 * stage (see DS v1.1, source comment "Plus d'onglets à ce stade").
 * One single markup: the switch is purely CSS (`hidden`/`min-[1100px]:flex`,
 * same principle as TabBar/DesktopHeader with NAV_BREAKPOINT_PX), never
 * content duplicated between the two layouts.
 *
 * <p>The core screen (batch 142): Tier Lists work for any universe, the
 * opportunities come from what has a progress, the discoveries from
 * each universe that knows how to offer some. "Prochaines sorties" left it
 * for lack of a source - an empty panel is not a promise, it is a box -
 * and comes back to it in batch 146 with data: volumes dated by Google
 * Books, games dated by IGDB, dates entered on the detail pages. Fourth
 * sub-tab on mobile, full width under the Découvertes on desktop. */
export function DiscoverPage() {
  const [tab, setTab] = useState<DiscoverTab>('tiers')

  return (
    <div className="flex flex-col gap-5">
      <EnTeteSection niveau={1} titre="Découvrir" />

      {/* The gate of the purchase analysis. It was the fourth destination
          of the navigation (product study of 2026-08-27, section 4) until batch 137:
          it is a MANGA journey - a lot of second-hand volumes compared to the
          collection - and the navigation bar no longer names any universe.
          It is reached from here, and from the detail page of a series ("Évaluer une
          annonce"). A link card like the yearly review further down, not a
          fourth panel: the editorial composition does not expect one. At the
          top, because it is an ACTION - one arrives with a listing in
          front of the eyes - whereas the panels are read. */}
      <Link
        to="/purchase-analysis"
        state={{ retour: { to: '/discover', libelle: 'Découvrir' } }}
        className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accentTint text-accentText">
          <Scale size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-medium text-textPrimary">Analyser une annonce</span>
          <span className="block text-xs text-textDim">
            Un lot de mangas d'occasion sous les yeux ? Confronte-le à ta collection avant d'acheter.
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-textDim" />
      </Link>

      {/* Four tabs that ALL fit in the width of a phone: one
          column each, the icon above the label under 640 px. The scrolling
          row from before cut the fourth one off screen (batch 146) - a
          tab that cannot be seen does not exist. */}
      <div role="tablist" className="grid grid-cols-4 border-b border-surface2 min-[1100px]:hidden">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 border-b-2 px-1 pb-1.5 text-[11px] font-semibold transition-colors sm:min-h-[46px] sm:flex-row sm:gap-2 sm:text-sm ${
              tab === id ? 'border-accent text-accentText' : 'border-transparent text-textDim'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8 min-[1100px]:grid min-[1100px]:grid-cols-[1.65fr_1fr] min-[1100px]:items-start min-[1100px]:gap-0">
        <section className={`flex-col gap-3 min-[1100px]:flex ${tab === 'tiers' ? 'flex' : 'hidden'}`}>
          <h2 className="sr-only">Tier Lists</h2>
          <DiscoverTierPreview />
        </section>

        <section
          className={`flex-col gap-3 min-[1100px]:flex min-[1100px]:border-l min-[1100px]:border-surface2 min-[1100px]:pl-7 ${tab === 'opps' ? 'flex' : 'hidden'}`}
        >
          <DiscoverOpportunitiesPreview />
        </section>

        <section
          className={`flex-col gap-3 min-[1100px]:col-span-2 min-[1100px]:flex min-[1100px]:border-t min-[1100px]:border-surface2 min-[1100px]:pt-6 ${tab === 'decouvertes' ? 'flex' : 'hidden'}`}
        >
          <DiscoverySection />
        </section>

        <section
          className={`flex-col gap-3 min-[1100px]:col-span-2 min-[1100px]:flex min-[1100px]:border-t min-[1100px]:border-surface2 min-[1100px]:pt-6 ${tab === 'sorties' ? 'flex' : 'hidden'}`}
        >
          <DiscoverReleasesPreview />
        </section>
      </div>

      {/* The yearly review left the Profil link list on 2026-08-29:
          it is a READING of the collection, like the three panels
          above, not a setting.

          A LINK and not a fourth tab: the three panels compose an editorial
          layout (1.65fr / 1fr, then full width), and the
          comment of this screen says "plus d'onglets à ce stade". The review
          is also a whole screen, not a panel - it has no place
          in a grid that does not expect one. */}
      <Link
        to="/recap"
        className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
          <PartyPopper size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-medium text-textPrimary">Bilan annuel</span>
          <span className="block text-xs text-textDim">Ton année en un coup d'œil, façon carte à partager</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-textDim" />
      </Link>
    </div>
  )
}
