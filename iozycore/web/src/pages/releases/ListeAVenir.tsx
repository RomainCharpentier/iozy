import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { getReleaseCalendar } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { LIBELLES_RELATION, libelleDateCourte, libelleMois, periodeSurUnAn } from '@/common/lib/releaseDate'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { useNow } from '@/common/hooks/useNow'
import { Jaquette } from '@/common/components/Jaquette'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import type { ReleaseEntryDto } from '@/common/types/api'
import { releasesToIcs } from '@/common/lib/releaseIcs'
import { cleDeSortie, grouperParMois } from './releaseCalendar'
import { Squelette } from '@/common/components/Squelette'

/**
 * Everything that comes within the year, month by month, in calendar order
 * (batch 146, usage feedback of 2026-09-10). The grid only shows one month;
 * this list answers the other question - "what is waiting for me?" - without
 * turning the pages. A row does not lead to the detail page: it brings the grid
 * to its day, where the agenda of the month does the rest.
 *
 * <p>Its own query, over one year minus one day from today: the
 * displayed month changes, not what is coming.
 */
export function ListeAVenir({
  libelleParType,
  onVoir,
  jamaisConsultees = false,
  className = '',
}: {
  libelleParType: Map<string, string>
  /** The month to show ("2026-11"), and the day to choose when the source knows it. */
  onVoir: (mois: string, jour: string | null) => void
  /** The sources were never read (see ReleasesPage): an empty year then
   *  means "not looked at", not "nothing coming". */
  jamaisConsultees?: boolean
  className?: string
}) {
  const { from, to } = periodeSurUnAn(useNow())
  const query = useQuery({
    queryKey: queryKeys.insights.releases(from, to),
    queryFn: () => getReleaseCalendar(from, to),
  })
  const entries = query.data?.entries ?? []
  const mois = grouperParMois(entries)
  const now = useNow()
  const [exportNote, setExportNote] = useState<string | null>(null)
  // The button only shows when the file would hold at least one event.
  const exportable = releasesToIcs(entries, now).included > 0

  function exportCalendar() {
    const { ics, included, skipped } = releasesToIcs(entries, new Date())
    downloadFile(ics, 'iozycore-sorties.ics')
    setExportNote(exportMessage(included, skipped))
  }

  return (
    <aside aria-labelledby="a-venir-titre" className={`flex flex-col gap-4 ${className}`}>
      <div>
        <h2 id="a-venir-titre" className="font-display text-lg font-bold tracking-[-0.02em] text-textPrimary">
          À venir
        </h2>
        <p className="text-sm text-textDim">Tout ce qui sort dans l'année pour ta collection et tes envies.</p>
        {exportable && (
          <button
            type="button"
            onClick={exportCalendar}
            className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-accentText"
          >
            <CalendarPlus size={16} aria-hidden="true" />
            Ajouter à mon agenda (.ics)
          </button>
        )}
        {exportNote && (
          <p role="status" className="text-sm text-textDim">
            {exportNote}
          </p>
        )}
      </div>

      {query.isError && <ErrorBanner message={query.error.message} />}
      {query.isLoading && <Squelette lignes={3} />}
      {query.isSuccess && mois.length === 0 && (
        <p className="text-sm text-textDim">
          {jamaisConsultees ? "Rien de connu : les sources n'ont pas encore été consultées." : "Rien d'annoncé pour l'année qui vient."}
        </p>
      )}

      {mois.map((m) => (
        <section key={m.mois} className="flex flex-col gap-1">
          <h3 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">{libelleMois(m.mois)}</h3>
          {m.entries.map((entry) => (
            <LigneAVenir key={cleDeSortie(entry)} entry={entry} typeLabel={libelleParType.get(entry.entityTypeId)} onVoir={onVoir} />
          ))}
        </section>
      ))}
    </aside>
  )
}

function LigneAVenir({
  entry,
  typeLabel,
  onVoir,
}: {
  entry: ReleaseEntryDto
  typeLabel?: string
  onVoir: (mois: string, jour: string | null) => void
}) {
  const auJour = entry.precision === 'DAY'
  const sousTitre = entry.label || typeLabel || ''
  return (
    <button
      type="button"
      onClick={() => onVoir(entry.date.slice(0, 7), auJour ? entry.date : null)}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface"
    >
      <span className="w-16 shrink-0 text-xs font-semibold text-textDim">{auJour ? libelleDateCourte(entry.date) : 'à préciser'}</span>
      <Jaquette
        src={entry.coverImageUrl}
        className="h-10 w-7 shrink-0 rounded object-cover"
        repli={<span className="h-10 w-7 shrink-0 rounded bg-surface2" />}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <TexteCoupe texte={entry.entityTitle} className="truncate text-sm font-semibold text-textPrimary" />
        {sousTitre && <TexteCoupe texte={sousTitre} className="truncate text-xs text-textDim" />}
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-textDim">{LIBELLES_RELATION[entry.relation] ?? entry.relation}</span>
    </button>
  )
}

/** What the file holds, and what it leaves out: a release only known to the month has no day to put in a calendar. */
function exportMessage(included: number, skipped: number): string {
  const written = included > 1 ? `${included} sorties à acheter ou en envie ajoutées au fichier.` : '1 sortie à acheter ou en envie ajoutée au fichier.'
  if (skipped === 0) return written
  const left = skipped > 1 ? `${skipped} sorties connues seulement au mois n'y sont pas.` : "1 sortie connue seulement au mois n'y est pas."
  return `${written} ${left}`
}

function downloadFile(content: string, name: string) {
  // jsdom has no object URL: the file is then simply not offered.
  if (typeof URL.createObjectURL !== 'function') return
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Revoked later: some browsers read the link after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
