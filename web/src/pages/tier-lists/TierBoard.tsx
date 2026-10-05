import { useState } from 'react'
import { TierBadge } from '@/common/components/TierBadge'
import { RANKS, type Rank, type TierListEntryDto } from '@/common/types/tierList'
import { Jaquette } from '@/common/components/Jaquette'

/**
 * Ranking board, pure presentation - shared between the general ranking
 * and a custom Tier List (same rendering, only the data source
 * and the mutations differ, see GeneralTierBoardPage/
 * CustomTierBoardPage). Main interaction: click on a cover ->
 * TierPicker (see the parent).
 * <p>
 * Drag and drop (DS v1.1 section 47) comes IN ADDITION since batch 14, never
 * instead: it is only available with a mouse (the HTML5 drag &
 * drop API ignores touch), and section 47 requires precisely that it never be
 * the only way to rank. Click and keyboard (Tab + Enter on the
 * cover, then S-F in the picker) therefore stay intact and are enough to
 * do everything.
 */
export function TierBoard({
  ranked,
  unranked,
  activeRanks,
  onSelectEntry,
  onDropEntry,
}: {
  ranked: Partial<Record<Rank, TierListEntryDto[]>>
  unranked: TierListEntryDto[]
  activeRanks: Rank[]
  onSelectEntry: (entry: TierListEntryDto) => void
  /** Absent = board read-only for drag and drop (click stays
   * active). `null` as a rank = brought back to "À classer". */
  onDropEntry?: (entry: TierListEntryDto, rank: Rank | null) => void
}) {
  // Entry being moved: kept here rather than read from
  // dataTransfer, which is not readable during dragover (HTML spec) - yet
  // it is during dragover that we decide to highlight the zone.
  const [draggedEntry, setDraggedEntry] = useState<TierListEntryDto | null>(null)
  const [hoveredZone, setHoveredZone] = useState<Rank | 'unranked' | null>(null)

  const dragEnabled = onDropEntry !== undefined

  const dropHandlers = (zone: Rank | 'unranked') =>
    dragEnabled
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault()
            setHoveredZone(zone)
          },
          onDragLeave: () => setHoveredZone((current) => (current === zone ? null : current)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            setHoveredZone(null)
            const entry = draggedEntry
            setDraggedEntry(null)
            // Dropping a work where it already is: send nothing rather
            // than replay the same mutation for an identical result.
            if (!entry) return
            const target = zone === 'unranked' ? null : zone
            if (entry.rank === target) return
            onDropEntry?.(entry, target)
          },
        }
      : {}

  const tileHandlers = (entry: TierListEntryDto) =>
    dragEnabled
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            setDraggedEntry(entry)
            // A non-empty dataTransfer is required by Firefox for the
            // drag to start - the value itself is never read back.
            e.dataTransfer.setData('text/plain', entry.entityId)
            e.dataTransfer.effectAllowed = 'move'
          },
          onDragEnd: () => {
            setDraggedEntry(null)
            setHoveredZone(null)
          },
        }
      : {}

  return (
    <div className="flex flex-col gap-2">
      {RANKS.filter((r) => activeRanks.includes(r)).map((rank) => {
        const entries = ranked[rank] ?? []
        return (
          <div
            key={rank}
            {...dropHandlers(rank)}
            className={`flex items-stretch gap-3 rounded-2xl border bg-surface p-2.5 transition-colors ${
              hoveredZone === rank ? 'border-accent bg-accentTint' : 'border-surface2'
            }`}
          >
            <div className="flex w-[52px] shrink-0 items-center justify-center sm:w-[58px]">
              <TierBadge rank={rank} />
            </div>
            <div className="flex min-h-[64px] flex-1 flex-wrap items-center gap-2 py-1">
              {entries.length === 0 && (
                <span className="px-2 text-xs text-textDim">
                  {hoveredZone === rank ? 'Déposer ici' : "Rien ici pour l'instant"}
                </span>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.entityId}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  // The rank is part of the name: it reads visually in the
                  // row (see TierBadge on the left), but nothing associates it with the
                  // tile for whoever does not see the layout. Without aria-label,
                  // a tile with a cover had no name but its `title`,
                  // last resort of the accname algorithm (see batch 29) - the
                  // tile WITHOUT a cover, for its part, already carried its title as text.
                  aria-label={`${entry.title}, rang ${rank}`}
                  title={entry.title}
                  {...tileHandlers(entry)}
                  className={`aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:w-12 ${
                    draggedEntry?.entityId === entry.entityId ? 'opacity-40' : ''
                  }`}
                >
                  <Jaquette
                    src={entry.coverImageUrl}
                    className="h-full w-full object-cover"
                    repli={
                      <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                        {entry.title}
                      </span>
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* "À classer" is also a drop zone: it is the only way to
          UN-rank by drag and drop, otherwise the gesture would only be
          reversible by clicking. Shown as soon as a drag is in progress,
          even empty, otherwise there would be nowhere to aim. */}
      {(unranked.length > 0 || draggedEntry) && (
        <div
          {...dropHandlers('unranked')}
          className={`mt-3 flex flex-col gap-2 rounded-2xl border p-2.5 transition-colors ${
            hoveredZone === 'unranked' ? 'border-accent bg-accentTint' : 'border-transparent'
          }`}
        >
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">
            À classer ({unranked.length})
          </span>
          <div className="flex min-h-[40px] flex-wrap gap-2">
            {unranked.length === 0 && <span className="px-1 text-xs text-textDim">Déposer ici pour déclasser</span>}
            {unranked.map((entry) => (
              <button
                key={entry.entityId}
                type="button"
                onClick={() => onSelectEntry(entry)}
                aria-label={`${entry.title}, non classée`}
                title={entry.title}
                {...tileHandlers(entry)}
                className={`aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-dashed ring-lineStrong transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:w-16 ${
                  draggedEntry?.entityId === entry.entityId ? 'opacity-40' : ''
                }`}
              >
                <Jaquette
                  src={entry.coverImageUrl}
                  className="h-full w-full object-cover"
                  repli={
                    <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                      {entry.title}
                    </span>
                  }
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
