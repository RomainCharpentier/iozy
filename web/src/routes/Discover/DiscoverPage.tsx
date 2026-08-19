import { useState } from 'react'
import { Bell, ListOrdered, Sparkles } from 'lucide-react'
import { TierListsHub } from './TierListsHub'

type DiscoverTab = 'tiers' | 'opps' | 'releases'

const TABS: { id: DiscoverTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'tiers', label: 'Tier Lists', icon: ListOrdered },
  { id: 'opps', label: 'Opportunités', icon: Sparkles },
  { id: 'releases', label: 'Prochaines sorties', icon: Bell },
]

/** Structure réelle à 3 sous-onglets (role="tab"/aria-selected comme le
 * reste de l'app - voir VolumeInteractionPanel pour le même pattern).
 * Tier Lists est branché sur son vrai domaine backend (voir TierListsHub,
 * Lot 7). Opportunités/Sorties seront adaptés de l'existant (Suggestions
 * d'achats, Envies d'amélioration) en Lot 6, pas dupliqués ici en hâte -
 * mieux vaut un onglet honnête "à venir" qu'un contenu à moitié câblé (voir
 * §59/§66 : jamais de toast simulant une fonctionnalité). */
export function DiscoverPage() {
  const [tab, setTab] = useState<DiscoverTab>('tiers')

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Découvrir</h1>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-surface2">
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

      {tab === 'tiers' && <TierListsHub />}

      {tab !== 'tiers' && (
        <div className="rounded-2xl border border-surface2 bg-surface p-8 text-center">
          <p className="font-display text-base font-semibold text-textPrimary">Bientôt disponible</p>
          <p className="mt-1.5 text-sm text-textDim">
            {tab === 'opps' && "Les opportunités d'achat pertinentes pour ta collection arrivent bientôt ici."}
            {tab === 'releases' && 'Les prochaines sorties des séries que tu suis arrivent bientôt ici.'}
          </p>
        </div>
      )}
    </div>
  )
}
