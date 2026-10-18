import { Jaquette } from '@/common/components/Jaquette'
import { JOURS_DE_LA_SEMAINE_COURTS, libelleJour, libelleMois } from '@/common/lib/releaseDate'
import type { ReleaseEntryDto } from '@/common/types/api'
import { cleDeSortie, grilleDuMois, type CaseDuMois } from './releaseCalendar'

/** Beyond that, the cell writes "+n" rather than stacking: it is 49 px wide on a phone. */
const JAQUETTES_PAR_CASE = 2

const CLASSE_CASE = 'flex min-h-14 w-full flex-col gap-1 rounded-lg p-1 sm:min-h-20'

/**
 * The month as a grid, Monday first (batch 146): each day in its place,
 * today marked, the days of the neighbouring months greyed out to complete the
 * week. A day that has releases shows their covers and can be chosen:
 * the agenda below then shows only it.
 *
 * <p>A table, not an ARIA grid: the columns are the days of the
 * week and the rows are weeks - it is exactly what a table says
 * to a screen reader, without reinventing keyboard navigation. Only the
 * days that have something are buttons: an empty day has nothing to
 * open, making it a target would teach nothing.
 */
export function GrilleDuMois({
  mois,
  parJour,
  jourChoisi,
  onChoisir,
  aujourdHui,
}: {
  /** "2026-10" */
  mois: string
  /** The releases dated to the day, by ISO day - already filtered by category. */
  parJour: Map<string, ReleaseEntryDto[]>
  jourChoisi: string | null
  /** `null` to go back to the whole month. */
  onChoisir: (iso: string | null) => void
  /** "2026-10-14", the local date of the device. */
  aujourdHui: string
}) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0.5" aria-label={`Grille de ${libelleMois(mois).toLowerCase()}`}>
      <thead>
        <tr>
          {JOURS_DE_LA_SEMAINE_COURTS.map((jour) => (
            <th key={jour} scope="col" className="pb-1 text-center text-[11px] font-semibold tracking-wide text-textDim uppercase">
              {jour}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grilleDuMois(mois).map((semaine) => (
          <tr key={semaine[0]?.iso}>
            {semaine.map((c) => (
              <td key={c.iso} className="p-0 align-top">
                <Case
                  c={c}
                  entries={c.horsMois ? [] : (parJour.get(c.iso) ?? [])}
                  choisi={c.iso === jourChoisi}
                  estAujourdHui={c.iso === aujourdHui}
                  onChoisir={onChoisir}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Case({
  c,
  entries,
  choisi,
  estAujourdHui,
  onChoisir,
}: {
  c: CaseDuMois
  entries: ReleaseEntryDto[]
  choisi: boolean
  estAujourdHui: boolean
  onChoisir: (iso: string | null) => void
}) {
  const numero = (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        estAujourdHui ? 'bg-accent text-accentInk' : ''
      }`}
    >
      {c.jour}
    </span>
  )

  if (c.horsMois) {
    return (
      <div className={`${CLASSE_CASE} text-faint`} aria-hidden="true">
        {numero}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={`${CLASSE_CASE} text-textDim`} aria-current={estAujourdHui ? 'date' : undefined}>
        {numero}
      </div>
    )
  }

  const nb = entries.length
  return (
    <button
      type="button"
      onClick={() => onChoisir(choisi ? null : c.iso)}
      aria-pressed={choisi}
      aria-current={estAujourdHui ? 'date' : undefined}
      aria-label={`${libelleJour(c.iso)}, ${nb} ${nb > 1 ? 'sorties' : 'sortie'}`}
      className={`${CLASSE_CASE} border text-left text-textPrimary transition-colors ${
        choisi ? 'border-accent bg-accentTint' : 'border-surface2 bg-surface hover:bg-surface2'
      }`}
    >
      {numero}
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {entries.slice(0, JAQUETTES_PAR_CASE).map((entry) => (
          <Jaquette
            key={cleDeSortie(entry)}
            src={entry.coverImageUrl}
            className="h-6 w-4 rounded-[3px] object-cover sm:h-8 sm:w-[22px]"
            repli={<span className="h-6 w-4 rounded-[3px] bg-surface2 sm:h-8 sm:w-[22px]" />}
          />
        ))}
        {nb > JAQUETTES_PAR_CASE && <span className="text-[11px] font-semibold text-textDim">+{nb - JAQUETTES_PAR_CASE}</span>}
      </span>
    </button>
  )
}
