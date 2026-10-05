import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Jaquette } from './Jaquette'
import { TexteCoupe } from './TexteCoupe'
import { LIBELLES_RELATION, libelleDateCourte } from '@/common/lib/releaseDate'
import type { Retour } from '@/common/lib/retour'
import type { ReleaseEntryDto } from '@/common/types/api'

/**
 * What calls for a pill: to buy is the action, wish is the expectation.
 * Owned calls for nothing - a discreet note is enough, one more pill
 * would make a row shout that has nothing to ask.
 */
const PASTILLES: Record<string, string> = {
  MISSING: 'bg-accentTint text-accentText',
  WANTED: 'bg-warningTint text-warning',
}

/**
 * One release of the calendar: the cover of what is coming out, the work, what comes out
 * within it, and what it means for the collection - always written,
 * like the reason of an opportunity in Discover. Shared by the calendar
 * and by its preview in Discover (batch 146), hence its place in `common`.
 *
 * <p>Where the date comes from is not written here: it is plumbing, and the
 * detail page of the work already carries it for whoever wants to know.
 *
 * @param date       the date label to write at the start of the row - absent when
 *                   the list is already grouped by day
 * @param typeLabel  the category, written when nothing more precise says what
 *                   is coming out (a game, a work dated by hand)
 */
export function ReleaseRow({
  entry,
  typeLabel,
  date,
  retour,
}: {
  entry: ReleaseEntryDto
  typeLabel?: string
  date?: string
  retour: Retour
}) {
  const sousTitre = entry.label || typeLabel || ''
  const dateAffichee = date ? libelleDateCourte(entry.date) : null
  const relation = LIBELLES_RELATION[entry.relation] ?? entry.relation
  const pastille = PASTILLES[entry.relation]
  return (
    <Link
      to={`/entity/${entry.entityId}`}
      state={{ retour }}
      className="flex w-full items-center gap-3 rounded-2xl border border-surface2 bg-surface p-3 text-left shadow-token-sm transition-transform hover:-translate-y-0.5"
    >
      {dateAffichee && (
        <span className="w-14 shrink-0 text-xs font-semibold text-textDim" aria-label={`Le ${dateAffichee}`}>
          {dateAffichee}
        </span>
      )}
      <Jaquette
        src={entry.coverImageUrl}
        className="h-[58px] w-10 shrink-0 rounded-md object-cover"
        repli={<span className="h-[58px] w-10 shrink-0 rounded-md bg-surface2" />}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TexteCoupe texte={entry.entityTitle} className="truncate text-sm font-semibold text-textPrimary" />
        {sousTitre && <TexteCoupe texte={sousTitre} className="truncate text-xs text-textDim" />}
      </span>
      {pastille ? (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${pastille}`}>{relation}</span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-textDim">
          <Check size={12} aria-hidden="true" />
          {relation}
        </span>
      )}
    </Link>
  )
}
