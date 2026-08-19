import { TierBadge } from './TierBadge'
import { RANKS, type Rank, type TierListEntryDto } from '../../types/tierList'

/**
 * Board de classement, présentation pure - partagé entre le classement
 * général et une Tier List personnalisée (même rendu, seule la source des
 * données et les mutations diffèrent, voir GeneralTierBoardPage/
 * CustomTierBoardPage). Interaction principale : clic sur une jaquette ->
 * TierPicker (voir le parent) - le drag & drop reste possible en ajout
 * futur, jamais la SEULE interaction disponible (voir DS v1.1 §47).
 */
export function TierBoard({
  ranked,
  unranked,
  activeRanks,
  onSelectEntry,
}: {
  ranked: Partial<Record<Rank, TierListEntryDto[]>>
  unranked: TierListEntryDto[]
  activeRanks: Rank[]
  onSelectEntry: (entry: TierListEntryDto) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {RANKS.filter((r) => activeRanks.includes(r)).map((rank) => {
        const entries = ranked[rank] ?? []
        return (
          <div key={rank} className="flex items-stretch gap-3 rounded-2xl border border-surface2 bg-surface p-2.5">
            <div className="flex w-[52px] shrink-0 items-center justify-center sm:w-[58px]">
              <TierBadge rank={rank} />
            </div>
            <div className="flex min-h-[64px] flex-1 flex-wrap items-center gap-2 py-1">
              {entries.length === 0 && <span className="px-2 text-xs text-textDim">Rien ici pour l'instant</span>}
              {entries.map((entry) => (
                <button
                  key={entry.entityId}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  title={entry.title}
                  className="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:w-12"
                >
                  {entry.coverImageUrl ? (
                    <img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                      {entry.title}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {unranked.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">
            À classer ({unranked.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {unranked.map((entry) => (
              <button
                key={entry.entityId}
                type="button"
                onClick={() => onSelectEntry(entry)}
                title={entry.title}
                className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-dashed ring-lineStrong transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:w-16"
              >
                {entry.coverImageUrl ? (
                  <img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                    {entry.title}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
