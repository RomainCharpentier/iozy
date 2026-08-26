import { useState } from 'react'
import { Bell, ListOrdered, Sparkles } from 'lucide-react'
import { DiscoverTierPreview } from './DiscoverTierPreview'
import { DiscoverOpportunitiesPreview } from './DiscoverOpportunitiesPreview'
import { DiscoverReleasesPanel } from './DiscoverReleasesPanel'
import { EnTeteSection } from '../../components/EnTeteSection'

type DiscoverTab = 'tiers' | 'opps' | 'releases'

const TABS: { id: DiscoverTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'tiers', label: 'Tier Lists', icon: ListOrdered },
  { id: 'opps', label: 'Opportunités', icon: Sparkles },
  { id: 'releases', label: 'Prochaines sorties', icon: Bell },
]

/** Sous 1100px (mobile ou desktop étroit) : 3 sous-onglets, un seul panneau
 * visible à la fois (role="tab"/aria-selected, même pattern que
 * VolumeInteractionPanel). À partir de 1100px sur desktop : composition
 * éditoriale réelle - Tier Lists sur ~62%, Opportunités à côté (bordure de
 * séparation), Sorties en pleine largeur dessous - plus d'onglets à ce
 * stade (voir DS v1.1, commentaire source "Plus d'onglets à ce stade").
 * Un seul markup : la bascule est purement CSS (`hidden`/`min-[1100px]:flex`,
 * même principe que TabBar/DesktopHeader avec NAV_BREAKPOINT_PX), jamais du
 * contenu dupliqué entre les deux mises en page. */
export function DiscoverPage() {
  const [tab, setTab] = useState<DiscoverTab>('tiers')

  return (
    <div className="flex flex-col gap-5">
      <EnTeteSection niveau={1} titre="Découvrir" />

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-surface2 min-[1100px]:hidden">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-[46px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-sm font-semibold transition-colors ${
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
          className={`flex-col gap-3 min-[1100px]:col-span-2 min-[1100px]:flex min-[1100px]:border-t min-[1100px]:border-surface2 min-[1100px]:pt-6 ${tab === 'releases' ? 'flex' : 'hidden'}`}
        >
          <DiscoverReleasesPanel />
        </section>
      </div>
    </div>
  )
}
