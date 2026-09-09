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

/** Sous 1100px (mobile ou desktop étroit) : 3 sous-onglets, un seul panneau
 * visible à la fois (role="tab"/aria-selected - le seul jeu d'onglets de
 * l'application). À partir de 1100px sur desktop : composition
 * éditoriale réelle - Tier Lists sur ~62%, Opportunités à côté (bordure de
 * séparation), Découvertes en pleine largeur dessous - plus d'onglets à ce
 * stade (voir DS v1.1, commentaire source "Plus d'onglets à ce stade").
 * Un seul markup : la bascule est purement CSS (`hidden`/`min-[1100px]:flex`,
 * même principe que TabBar/DesktopHeader avec NAV_BREAKPOINT_PX), jamais du
 * contenu dupliqué entre les deux mises en page.
 *
 * <p>L'écran du cœur (lot 142) : les Tier Lists valent pour tout univers, les
 * opportunités viennent de ce qui a une progression, les découvertes de
 * chaque univers qui sait en proposer. « Prochaines sorties » en était parti
 * faute de source - un panneau vide n'est pas une promesse, c'est une case -
 * et y revient au lot 146 avec des données : les tomes datés par Google
 * Books, les jeux datés par IGDB, les dates saisies sur les fiches. Quatrième
 * sous-onglet en mobile, pleine largeur sous les Découvertes en desktop. */
export function DiscoverPage() {
  const [tab, setTab] = useState<DiscoverTab>('tiers')

  return (
    <div className="flex flex-col gap-5">
      <EnTeteSection niveau={1} titre="Découvrir" />

      {/* La porte de l'analyse d'achat. Elle a été la quatrième destination
          de la navigation (étude produit du 2026-08-27, §4) jusqu'au lot 137 :
          c'est un parcours MANGA - un lot de tomes d'occasion confronté à la
          collection - et la barre de navigation ne nomme plus aucun univers.
          Il se rejoint d'ici, et depuis la fiche d'une série (« Évaluer une
          annonce »). Une carte-lien comme le bilan annuel plus bas, pas un
          quatrième panneau : la composition éditoriale n'en attend pas. En
          tête, parce que c'est une ACTION - on arrive avec une annonce sous
          les yeux - là où les panneaux se lisent. */}
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

      <div role="tablist" className="defilement-discret flex gap-1 overflow-x-auto border-b border-surface2 min-[1100px]:hidden">
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

      {/* Le bilan annuel a quitté la liste de liens de Profil le 2026-08-29 :
          c'est une LECTURE de la collection, comme les trois panneaux
          ci-dessus, pas un réglage.

          Un LIEN et non un quatrième onglet : les trois panneaux composent une
          mise en page éditoriale (1,65fr / 1fr, puis pleine largeur), et le
          commentaire de cet écran dit « plus d'onglets à ce stade ». Le bilan
          est d'ailleurs un écran entier, pas un panneau - il n'a rien à faire
          dans une grille qui n'en attend pas. */}
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
