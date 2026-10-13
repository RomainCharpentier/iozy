import { useState } from 'react'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { useAuth } from '@/common/hooks/useAuth'
import { libelleIlYA } from '@/common/lib/releaseDate'
import type { ReleaseRefreshRunDto } from '@/common/types/api'
import { useReleaseRefresh } from './useReleaseRefresh'

/** What the last pass left behind, said in one line - nothing is promised that the pass did not do. */
function resume(run: ReleaseRefreshRunDto | null, now: Date): string {
  // "jamais été mises à jour" sat above a listed release (a date typed on a
  // detail page): it is the SOURCES that were never read, not the calendar.
  if (!run) return "Les sources de sorties n'ont pas encore été consultées."
  const parties = [`Sorties mises à jour ${libelleIlYA(run.startedAt, now)}`]
  if (run.error) parties.push('la dernière mise à jour a échoué')
  else if (run.stoppedOnUnavailableProvider) parties.push('interrompue : une source ne répond plus')
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
  const [now] = useState(() => new Date())
  if (!status?.available) return null

  const enCours = status.running || launch.isPending

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm text-textDim" role="status">
          {enCours ? 'Mise à jour des sorties en cours…' : resume(status.lastRun, now)}
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
