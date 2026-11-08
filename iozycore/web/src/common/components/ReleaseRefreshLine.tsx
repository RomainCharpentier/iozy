import { ErrorBanner } from '@/common/components/ErrorBanner'
import { useAuth } from '@/common/hooks/useAuth'
import { useNow } from '@/common/hooks/useNow'
import { libelleIlYA, libelleProchainement } from '@/common/lib/releaseDate'
import type { ReleaseRefreshOutcome, ReleaseRefreshStatusDto } from '@/common/types/api'
import { useReleaseRefresh } from '@/common/hooks/useReleaseRefresh'

/** What the last pass did when it did not simply re-read everything; null when there is nothing to add. */
function issue(outcome: ReleaseRefreshOutcome, sourceSilent: boolean): string | null {
  switch (outcome) {
    case 'FAILED':
      return 'la dernière mise à jour a échoué'
    case 'TIMED_OUT':
      return 'la dernière mise à jour a été abandonnée, trop longue'
    case 'SKIPPED':
      return 'la mise à jour de nuit a été sautée : une autre tournait déjà'
    default:
      // The fallback is said: a silent source leaves the dates of the last reading on screen.
      return sourceSilent ? 'une source ne répond pas : dates de la dernière lecture' : null
  }
}

/**
 * What the passes left behind, said in one line - nothing is promised that a pass did not do.
 * "mises à jour il y a" counts from the last pass that moved the calendar forward, not
 * from the last pass: a skipped or silent pass updated nothing.
 */
function resume(status: ReleaseRefreshStatusDto, now: Date): string {
  const run = status.lastRun
  // "jamais été mises à jour" sat above a listed release (a date typed on a
  // detail page): it is the SOURCES that were never read, not the calendar.
  if (!run) return "Les sources de sorties n'ont pas encore été consultées."
  const parties = [
    status.lastSuccessAt
      ? `Sorties mises à jour ${libelleIlYA(status.lastSuccessAt, now)}`
      : "Les sources de sorties n'ont pas encore répondu",
  ]
  const detail = issue(run.outcome, status.sourceSilent)
  if (detail) parties.push(detail)
  if (run.remaining > 0) parties.push(`${run.remaining} ${run.remaining === 1 ? 'série reste' : 'séries restent'} à relire`)
  return parties.join(' · ')
}

/**
 * When the release dates were last refreshed, and the button to refresh them
 * now. The refresh also runs at night; on a machine that is off at that hour
 * (local mode) this is how the calendar is kept up to date. A visitor reads the
 * date but has no button: they cannot write.
 */
export function ReleaseRefreshLine() {
  const { estInvite } = useAuth()
  const { status, launch } = useReleaseRefresh()
  // Read once: the line says how long ago, it does not tick.
  const now = useNow()
  if (!status?.available) return null

  const enCours = status.running || launch.isPending
  // ONE line (lot 215): the state of the data is a footnote of the page, not a
  // block. The next automatic pass closes it.
  const texte = enCours
    ? 'Mise à jour des sorties en cours…'
    : [resume(status, now), status.nextPlannedAt && `prochaine mise à jour automatique ${libelleProchainement(status.nextPlannedAt, now)}`]
        .filter(Boolean)
        .join(' · ')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm text-textDim" role="status">
          {texte}
        </p>
        {!estInvite && (
          <button
            type="button"
            onClick={() => launch.mutate()}
            disabled={enCours}
            className="min-h-11 shrink-0 text-sm font-semibold text-accentText disabled:opacity-50"
          >
            Mettre à jour maintenant
          </button>
        )}
      </div>
      {/* A pass already running (409) is not a failure to show: the status says so. */}
      {launch.isError && !status.running && <ErrorBanner message={launch.error.message} />}
    </div>
  )
}
