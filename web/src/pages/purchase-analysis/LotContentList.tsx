import { X } from 'lucide-react'

/**
 * The canonical list of the batch: **what really goes to the analysis**.
 *
 * It is displayed at the top of the section, before the proposals and before the
 * form, because it is the truth. The two other blocks are only
 * ways to feed it — there are not two parallel batches.
 *
 * <h2>Once in the batch, a volume is a volume</h2>
 * An item coming from the detection and an item entered by hand are
 * strictly the same thing here: same row, same remove button. The
 * origin served to decide, it no longer has to structure the final list.
 */

export interface LotItem {
  seriesTitle: string
  editionName: string
  volumesText: string
  includedVolumes: number[]
}

export function LotContentList({
  items,
  ligneEnCours,
  onRemove,
}: {
  items: LotItem[]
  /**
   * The form row, complete but not yet "added".
   *
   * It counts in the analysis (the "+" is no longer required), so
   * it must be seen here - otherwise the count would lie. Marked "being
   * entered" to remove the ambiguity with the items already placed.
   */
  ligneEnCours: LotItem | null
  onRemove: (index: number) => void
}) {
  if (items.length === 0 && !ligneEnCours) {
    return (
      <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-textDim">
        Ce que tu confirmes arrive ici.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <li
          key={`${item.seriesTitle}-${item.editionName}-${index}`}
          className="flex items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary"
        >
          <span>
            {item.seriesTitle} · {item.editionName} · {item.includedVolumes.length} tome
            {item.includedVolumes.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Retirer ${item.seriesTitle} du lot`}
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3 text-textDim hover:text-dangerText"
          >
            <X size={14} />
          </button>
        </li>
      ))}

      {ligneEnCours && (
        <li className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-fieldBorder bg-surface2/50 px-3 py-2 text-sm text-textPrimary">
          <span>
            {ligneEnCours.seriesTitle} · {ligneEnCours.editionName} ·{' '}
            {ligneEnCours.includedVolumes.length} tome
            {ligneEnCours.includedVolumes.length > 1 ? 's' : ''}
          </span>
          {/* The dotted line is not enough: colour and shape alone
              explain nothing to someone who cannot tell them apart. */}
          <span className="shrink-0 text-xs text-textDim">en cours de saisie</span>
        </li>
      )}
    </ul>
  )
}
