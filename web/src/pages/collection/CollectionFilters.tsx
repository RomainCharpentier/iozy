import { X } from 'lucide-react'
import { useModalA11y } from '@/common/hooks/useModalA11y'
import type { TriCollection, VueCollection } from '@/common/lib/preferencesCollection'
import type { TagDto } from '@/common/types/api'

export type CompletionFilter = 'ALL' | 'INCOMPLETE' | 'COMPLETE'

const STATUS_OPTIONS: { value: CompletionFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'INCOMPLETE', label: 'Incomplètes' },
  { value: 'COMPLETE', label: 'Complètes' },
]

// "Un par un", and not "les tomes": the volume is the vocabulary of manga,
// and each collection type has its own groups (a series, a saga, a range).
const VUE_OPTIONS: { value: VueCollection; label: string }[] = [
  { value: 'groupee', label: 'Groupés' },
  { value: 'plate', label: 'Un par un' },
]

const TRI_OPTIONS: { value: TriCollection; label: string }[] = [
  { value: 'recent', label: 'Récents d’abord' },
  { value: 'titre', label: 'Par titre' },
]

/**
 * Desktop popover / mobile bottom sheet - same content, a single responsive
 * component (same pattern as TierPicker).
 *
 * <h2>How the shelf is shown, then what it keeps</h2>
 * The grouping and the sort used to be two more buttons above the shelf: with
 * Filtres, Valeur and "Plus d'outils" that made eight controls before the
 * first cover, about 40% of a phone screen (UI review of 2026-10-13). They are
 * settings one changes rarely, so they live here, first, under "Affichage".
 *
 * <p>Two filters, both computable today: "État de la collection"
 * (same logic as Purchase suggestions / detail page completeness) and "Tag", whose
 * section appears ONLY if tags exist - otherwise this would be
 * exactly the filter that never filters anything, which we refused to add
 * here. The V1.2 mockup also plans "Sortie annoncée" and "Classement" (by
 * Tier List) - left out, BLOCKED_BY_DATA (no release date and no
 * ranking exists on the backend, see docs/DESIGN_MIGRATION_V1.2.md).
 */
export function CollectionFilters({
  open,
  onClose,
  vue,
  onVue,
  tri,
  onTri,
  status,
  onStatusChange,
  tags,
  tagId,
  onTagChange,
  onReset,
}: {
  open: boolean
  onClose: () => void
  vue: VueCollection
  onVue: (vue: VueCollection) => void
  tri: TriCollection
  onTri: (tri: TriCollection) => void
  status: CompletionFilter
  onStatusChange: (status: CompletionFilter) => void
  tags: TagDto[]
  tagId: string | null
  onTagChange: (tagId: string | null) => void
  onReset: () => void
}) {
  // Escape + focus trap + focus returned to the trigger - see
  // useModalA11y (Batch 9, generic, shared by all the dialogs of the app).
  const containerRef = useModalA11y<HTMLDivElement>(open, onClose)

  if (!open) return null

  return (
    <>
      {/* Overlay clickable-to-close only for the thumb (full
          screen sheet) - desktop stays a simple anchored popover, closing by click
          outside handled by a transparent full-screen layer (see the
          V1.2 mockup, line ~1752: overlay without visible background on desktop). */}
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
            Affichage
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
          <GroupeRadio titre="Regrouper" options={VUE_OPTIONS} valeur={vue} onChoisir={onVue} />
          <GroupeRadio titre="Trier" options={TRI_OPTIONS} valeur={tri} onChoisir={onTri} />
          <GroupeRadio titre="État de la collection" options={STATUS_OPTIONS} valeur={status} onChoisir={onStatusChange} />
          {/* No tag set anywhere: no section. A filter that
              cannot keep anything mostly tells the user that something is missing,
              without saying what. */}
          {tags.length > 0 && (
            <GroupeRadio
              titre="Tag"
              options={[{ value: null, label: 'Tous' }, ...tags.map((tag) => ({ value: tag.id, label: tag.label }))]}
              valeur={tagId}
              onChoisir={onTagChange}
            />
          )}
          {/* Resets the FILTERS only: grouping and sort are a way of looking,
              they never hide part of the collection. */}
          {(status !== 'ALL' || tagId !== null) && (
            <button type="button" onClick={onReset} className="w-fit px-2 text-sm font-semibold text-accentText">
              Effacer les filtres
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/** One titled set of choices that exclude each other: a real `radiogroup`. */
function GroupeRadio<T extends string | null>({
  titre,
  options,
  valeur,
  onChoisir,
}: {
  titre: string
  options: { value: T; label: string }[]
  valeur: T
  onChoisir: (valeur: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 text-[11px] font-semibold tracking-wide text-textDim uppercase">{titre}</span>
      <div role="radiogroup" aria-label={titre} className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const choisi = valeur === opt.value
          return (
            <button
              key={opt.value ?? 'tous'}
              type="button"
              role="radio"
              aria-checked={choisi}
              onClick={() => onChoisir(opt.value)}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-sm transition-colors ${
                choisi ? 'text-textPrimary' : 'text-textDim hover:bg-rowHover'
              }`}
            >
              <span
                className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-2 ${
                  choisi ? 'border-accent' : 'border-lineStrong'
                }`}
              >
                {choisi && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
