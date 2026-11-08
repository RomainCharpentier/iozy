import { Link } from 'react-router-dom'
import { Jaquette } from '@/common/components/Jaquette'
import { libelleDateCourte, libelleJour } from '@/common/lib/releaseDate'
import type { ReleaseEntryDto } from '@/common/types/api'
import { estManquante } from './releaseCalendar'
import { nomDeSortie } from './useJeLAiSortie'

const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

/** "13" and "nov." for a day; "—" and "déc." for a release known to the month only. */
function jourEtMois(entry: ReleaseEntryDto): { jour: string; mois: string } {
  const [a, m, j] = entry.date.split('-').map(Number)
  const mois = MOIS_COURT.format(new Date(Date.UTC(a, m - 1, 1)))
  return entry.precision === 'DAY' ? { jour: String(j), mois } : { jour: '—', mois }
}

/** "le vendredi 13 novembre", or "en décembre, date à préciser". */
function quandEnToutesLettres(entry: ReleaseEntryDto): string {
  return entry.precision === 'DAY' ? `le ${libelleJour(entry.date)}` : `${libelleDateCourte(entry.date)}, date à préciser`
}

/**
 * One release of the list (lot 215): its cover, its day in big, what comes out.
 *
 * <h2>The shape says the state</h2>
 * Nothing written under it. What the collection already has (owned, or
 * pre-ordered) is a plain piece of glass that leads to the work. What it does
 * not have breathes in the vivid tone of the cover (`.iozy-manque`), and a
 * click on it says "je l'ai précommandé" - the accessible name says so.
 */
export function CarteSortie({
  entry,
  aspectClassName,
  retour,
  onJeLAi,
  enCours = false,
}: {
  entry: ReleaseEntryDto
  /** The shape of a cover of this category (its `aspectKey`). */
  aspectClassName: string
  retour: { to: string; libelle: string }
  /** Absent for a guest, who writes nothing: the release then only leads to its work. */
  onJeLAi?: (entry: ReleaseEntryDto) => void
  /** The pre-order of this release is being written. */
  enCours?: boolean
}) {
  const { jour, mois } = jourEtMois(entry)
  const contenu = (
    <>
      <Jaquette
        src={entry.coverImageUrl}
        className={`w-16 shrink-0 rounded-lg object-cover ${aspectClassName}`}
        repli={<span className={`w-16 shrink-0 rounded-lg bg-surface2 ${aspectClassName}`} />}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-3xl leading-none font-bold tracking-[-0.03em] text-textPrimary">{jour}</span>
        <span className="text-xs text-textDim">{mois}</span>
        <span className="line-clamp-2 text-[13px] font-semibold text-textPrimary">{entry.entityTitle}</span>
        {entry.label && <span className="truncate text-xs text-textDim">{entry.label}</span>}
      </span>
    </>
  )
  const forme = 'flex w-full min-w-0 items-center gap-3 rounded-2xl p-2.5 text-left transition-transform duration-200 hover:-translate-y-0.5'

  const manquante = estManquante(entry)
  if (manquante && onJeLAi) {
    const nom = `${nomDeSortie(entry)}, ${quandEnToutesLettres(entry)} : je l'ai précommandé`
    return (
      <button
        type="button"
        onClick={() => onJeLAi(entry)}
        disabled={enCours}
        aria-label={nom}
        title={nom}
        className={`iozy-manque iozy-teinte ${forme} disabled:opacity-60`}
      >
        {contenu}
      </button>
    )
  }
  return (
    <Link
      to={`/entity/${entry.entityId}`}
      state={{ retour }}
      aria-label={`${nomDeSortie(entry)}, ${quandEnToutesLettres(entry)}`}
      className={`${manquante ? 'iozy-manque iozy-teinte' : 'iozy-verre'} ${forme}`}
    >
      {contenu}
    </Link>
  )
}
