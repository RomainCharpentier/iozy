import type { AffichageCollection } from '@/common/lib/preferencesCollection'

const AFFICHAGES: { cle: AffichageCollection; libelle: string }[] = [
  { cle: 'etageres', libelle: 'Étagères' },
  { cle: 'compact', libelle: 'Compact' },
]

/** Shelves with spines, or small covers: a habit, the same in a room and on a shelf page. */
export function BasculeAffichage({
  affichage,
  onChoisir,
}: {
  affichage: AffichageCollection
  onChoisir: (affichage: AffichageCollection) => void
}) {
  return (
    <div role="radiogroup" aria-label="Affichage" className="flex items-center gap-1 rounded-full bg-softBtn p-1">
      {AFFICHAGES.map(({ cle, libelle }) => {
        const actif = cle === affichage
        return (
          <button
            key={cle}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChoisir(cle)}
            className={`min-h-11 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors ${
              actif ? 'bg-surface font-semibold text-textPrimary shadow-token-sm' : 'text-faint hover:text-textPrimary'
            }`}
          >
            {libelle}
          </button>
        )
      })}
    </div>
  )
}
