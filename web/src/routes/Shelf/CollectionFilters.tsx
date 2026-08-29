import { X } from 'lucide-react'
import { useModalA11y } from '../../lib/useModalA11y'
import type { TagDto } from '../../types/api'

export type CompletionFilter = 'ALL' | 'INCOMPLETE' | 'COMPLETE'

const STATUS_OPTIONS: { value: CompletionFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'INCOMPLETE', label: 'Incomplètes' },
  { value: 'COMPLETE', label: 'Complètes' },
]

/**
 * Popover desktop / bottom sheet mobile - même contenu, un seul composant
 * responsive (même pattern que TierPicker).
 * Deux filtres, tous deux calculables aujourd'hui : "État de la collection"
 * (même logique que Suggestions d'achats/complétude de fiche) et "Tag", dont
 * la section n'apparaît QUE si des tags existent - sans quoi ce serait
 * exactement le filtre qui ne filtre jamais rien qu'on a refusé d'ajouter
 * ici. La maquette V1.2 prévoit aussi "Sortie annoncée" et "Classement" (par
 * Tier List) - omis, BLOCKED_BY_DATA (aucune date de sortie ni aucun
 * classement n'existe côté backend, voir docs/DESIGN_MIGRATION_V1.2.md).
 */
export function CollectionFilters({
  open,
  onClose,
  status,
  onStatusChange,
  tags,
  tagId,
  onTagChange,
  onReset,
}: {
  open: boolean
  onClose: () => void
  status: CompletionFilter
  onStatusChange: (status: CompletionFilter) => void
  tags: TagDto[]
  tagId: string | null
  onTagChange: (tagId: string | null) => void
  onReset: () => void
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
            <div role="radiogroup" aria-label="État de la collection" className="flex flex-col gap-0.5">
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
          {/* Aucun tag posé nulle part : pas de section. Un filtre qui ne
              peut rien retenir dit surtout à l'utilisateur qu'il lui manque
              quelque chose, sans dire quoi. */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="px-2 text-[11px] font-semibold tracking-wide text-textDim uppercase">Tag</span>
              <div role="radiogroup" aria-label="Tag" className="flex flex-col gap-0.5">
                {[{ id: null, label: 'Tous' }, ...tags].map((tag) => (
                  <button
                    key={tag.id ?? 'tous'}
                    type="button"
                    role="radio"
                    aria-checked={tagId === tag.id}
                    onClick={() => onTagChange(tag.id)}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-sm transition-colors ${
                      tagId === tag.id ? 'text-textPrimary' : 'text-textDim hover:bg-rowHover'
                    }`}
                  >
                    <span
                      className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-2 ${
                        tagId === tag.id ? 'border-accent' : 'border-lineStrong'
                      }`}
                    >
                      {tagId === tag.id && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </span>
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(status !== 'ALL' || tagId !== null) && (
            <button type="button" onClick={onReset} className="w-fit px-2 text-sm font-semibold text-accentText">
              Réinitialiser
            </button>
          )}
        </div>
      </div>
    </>
  )
}
