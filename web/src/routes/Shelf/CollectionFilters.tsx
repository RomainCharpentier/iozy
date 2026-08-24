import { X } from 'lucide-react'
import { useModalA11y } from '../../lib/useModalA11y'

export type CompletionFilter = 'ALL' | 'INCOMPLETE' | 'COMPLETE'

const STATUS_OPTIONS: { value: CompletionFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'INCOMPLETE', label: 'Incomplètes' },
  { value: 'COMPLETE', label: 'Complètes' },
]

/**
 * Popover desktop / bottom sheet mobile - même contenu, un seul composant
 * responsive (voir VolumeInteractionPanel pour le même pattern déjà établi).
 * Un seul filtre réel pour l'instant : "État de la collection" (calculable
 * dès aujourd'hui - même logique que Suggestions d'achats/complétude de
 * fiche). La maquette V1.2 prévoit aussi "Sortie annoncée" et "Classement"
 * (par Tier List) - omis ici, BLOCKED_BY_DATA (aucune date de sortie ni
 * aucun classement n'existe côté backend, voir
 * docs/DESIGN_MIGRATION_V1.2.md) plutôt que des filtres qui ne filtreraient
 * jamais rien.
 */
export function CollectionFilters({
  open,
  onClose,
  status,
  onStatusChange,
}: {
  open: boolean
  onClose: () => void
  status: CompletionFilter
  onStatusChange: (status: CompletionFilter) => void
}) {
  // Escape + piège de focus + focus rendu au déclencheur - voir
  // useModalA11y (Lot 9, générique, partagé par tous les dialogs de l'app).
  const containerRef = useModalA11y<HTMLDivElement>(open, onClose)

  if (!open) return null

  return (
    <>
      {/* Overlay cliquable-pour-fermer uniquement au pouce (sheet plein
          écran) - desktop reste un simple popover ancré, fermeture par clic
          extérieur gérée par un calque transparent plein écran (voir la
          maquette V1.2, ligne ~1752 : overlay sans fond visible en desktop). */}
      <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-filters-title"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-x-auto md:top-20 md:right-[max(12px,calc((100%-min(100%-48px,1600px))/2))] md:bottom-auto md:w-[312px] md:rounded-2xl md:border md:border-surface2"
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <h2 id="collection-filters-title" className="font-display text-base font-semibold text-textPrimary">
            Filtres
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:bg-rowHover hover:text-textPrimary"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-4 pt-2">
          <div className="flex flex-col gap-1">
            <span className="px-2 text-[11px] font-semibold tracking-wide text-textDim uppercase">État de la collection</span>
            <div role="radiogroup" className="flex flex-col gap-0.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={status === opt.value}
                  onClick={() => onStatusChange(opt.value)}
                  className={`flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-sm transition-colors ${
                    status === opt.value ? 'text-textPrimary' : 'text-textDim hover:bg-rowHover'
                  }`}
                >
                  <span
                    className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-2 ${
                      status === opt.value ? 'border-accent' : 'border-lineStrong'
                    }`}
                  >
                    {status === opt.value && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {status !== 'ALL' && (
            <button
              type="button"
              onClick={() => onStatusChange('ALL')}
              className="w-fit px-2 text-sm font-semibold text-accentText"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>
    </>
  )
}
