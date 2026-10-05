import { useEffect } from 'react'
import { X } from 'lucide-react'
import { TierBadge } from './TierBadge'
import { useModalA11y } from '@/common/hooks/useModalA11y'
import { RANKS, type Rank } from '@/common/types/tierList'
import { TexteCoupe } from './TexteCoupe'
import { Jaquette } from './Jaquette'

/**
 * Desktop popover / mobile bottom sheet - same responsive pattern already
 * established (CollectionFilters). Reused by the
 * board (click on a tile) AND by "Classer cette œuvre" from the detail page
 * - a single component for both entries (see §50 "Classer rapidement":
 * same picker, just chained item by item on the caller side).
 * <p>
 * Keyboard (see DS v1.1 §48): once open, the letters S-F
 * directly choose the matching rank IF active for this list,
 * Escape closes without change - in addition to the standard
 * Tab/Enter navigation on the buttons themselves.
 * <p>
 * In "Classer rapidement" mode (see useQuickRank), the same component also carries
 * a progress counter and a "Passer" button - never a
 * second picker in parallel: this is the promise of §50 ("same picker,
 * just chained item by item").
 */
export function TierPicker({
  open,
  onClose,
  title,
  coverImageUrl,
  activeRanks,
  currentRank,
  onSelect,
  progress = null,
  onSkip,
  onRemoveFromList,
}: {
  open: boolean
  onClose: () => void
  title: string
  coverImageUrl?: string | null
  activeRanks: Rank[]
  currentRank: Rank | null
  onSelect: (rank: Rank | null) => void
  /** "Classer rapidement" mode only: position in the queue (1-indexed). */
  progress?: { current: number; total: number } | null
  /** "Classer rapidement" mode only: leave this work unranked and
   * move on to the next - distinct from Close, which abandons the whole queue. */
  onSkip?: () => void
  /** CUSTOM Tier List only: remove the work from the list, not to be
   * confused with "Retirer le classement" below, which leaves it in the
   * list, simply unranked. Without this action, a work added by
   * mistake from AddTierListItemsPanel had no exit left, other than
   * deleting the whole list. Absent on the general ranking, where
   * membership is implicit (every owned work is a candidate, see
   * TierListService): there is nothing to remove it from. */
  onRemoveFromList?: () => void
}) {
  // Escape + focus trap + focus returned to the trigger - see
  // useModalA11y (Batch 9, generic, shared by all the dialogs of the app).
  const containerRef = useModalA11y<HTMLDivElement>(open, onClose)

  // S-F shortcuts: specific to this component (not a "generic dialog
  // a11y" concern), stays local. No longer intercepts Escape itself -
  // already handled by the hook above.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      const letter = e.key.toUpperCase()
      if (RANKS.includes(letter as Rank) && activeRanks.includes(letter as Rank)) {
        onSelect(letter as Rank)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onSelect, activeRanks])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-picker-title"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-x-auto md:top-1/2 md:right-auto md:left-1/2 md:bottom-auto md:w-[320px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-surface2"
      >
        <div className="flex items-center gap-3 border-b border-surface2 p-4">
          <Jaquette
            src={coverImageUrl}
            className="h-11 w-8 shrink-0 rounded object-cover"
            repli={<span className="h-11 w-8 shrink-0 rounded bg-surface2" />}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <TexteCoupe
              id="tier-picker-title"
              texte={title}
              className="truncate font-display text-sm font-semibold text-textPrimary"
            />
            {progress && (
              <span className="text-xs text-textDim">
                Classement rapide · {progress.current} / {progress.total}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {RANKS.filter((r) => activeRanks.includes(r)).map((rank) => (
            <button
              key={rank}
              type="button"
              onClick={() => onSelect(rank)}
              aria-pressed={currentRank === rank}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-transform hover:-translate-y-0.5 ${
                currentRank === rank ? 'ring-2 ring-accent' : ''
              }`}
            >
              <TierBadge rank={rank} size="picker" />
            </button>
          ))}
        </div>
        {currentRank && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="border-t border-surface2 py-3 text-center text-sm font-semibold text-textDim hover:text-textPrimary"
          >
            Retirer le classement
          </button>
        )}
        {/* "Passer" only exists in quick ranking: outside this mode, choosing
            nothing is already done by closing the picker. */}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="border-t border-surface2 py-3 text-center text-sm font-semibold text-textDim hover:text-textPrimary"
          >
            Passer cette œuvre
          </button>
        )}
        {onRemoveFromList && (
          <button
            type="button"
            onClick={onRemoveFromList}
            className="border-t border-surface2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm font-semibold text-dangerText hover:bg-dangerTint"
          >
            Retirer de cette Tier List
          </button>
        )}
      </div>
    </>
  )
}
