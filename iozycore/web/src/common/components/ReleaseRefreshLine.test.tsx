/**
 * <b>The refresh line leaves "en cours" when the pass ends.</b> It used to
 * stay on "Mise à jour des sorties en cours…" until a reload.
 *
 * <b>It never says "mises à jour" for a pass that updated nothing</b> (lot 208):
 * a skipped night slot or a silent source used to read as a fresh update.
 */
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ReleaseRefreshLine } from './ReleaseRefreshLine'

const insights = vi.hoisted(() => ({ getReleaseRefreshStatus: vi.fn(), startReleaseRefresh: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)
vi.mock('@/common/hooks/useAuth', () => ({ useAuth: () => ({ estInvite: false }) }))

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const RUN = {
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  origin: 'MANUAL',
  stale: 3,
  remaining: 0,
  refreshed: 3,
  stoppedOnUnavailableProvider: false,
  error: null,
  outcome: 'COMPLETED',
}

function ilYA(heures: number): string {
  return new Date(Date.now() - heures * 3_600_000).toISOString()
}

function termine(surcharge: Record<string, unknown>) {
  return { available: true, running: false, lastSuccessAt: RUN.finishedAt, nextPlannedAt: null, sourceSilent: false, scheduled: true, ...surcharge }
}

describe('the release refresh line', () => {
  it('says the pass is over once the server says so, without a reload', async () => {
    insights.getReleaseRefreshStatus
      .mockResolvedValueOnce({ available: true, running: false, lastRun: null })
      .mockResolvedValueOnce({ available: true, running: true, lastRun: null })
      .mockResolvedValue(termine({ lastRun: RUN }))
    insights.startReleaseRefresh.mockResolvedValue({ available: true, running: true, lastRun: null })
    render(<ReleaseRefreshLine />, { wrapper: enrobage })

    await userEvent.click(await screen.findByRole('button', { name: 'Mettre à jour maintenant' }))
    expect(await screen.findByText('Mise à jour des sorties en cours…')).toBeInTheDocument()

    expect(await screen.findByText(/Sorties mises à jour/, {}, { timeout: 6000 })).toBeInTheDocument()
  }, 10_000)

  it('keeps following the pass while the window has no focus', async () => {
    // A pass lasts long enough to switch tabs. The polling used to stop with
    // the focus, and the line stayed "en cours" until a reload.
    insights.getReleaseRefreshStatus
      .mockResolvedValueOnce({ available: true, running: false, lastRun: null })
      .mockResolvedValueOnce({ available: true, running: true, lastRun: null })
      .mockResolvedValue(termine({ lastRun: RUN }))
    insights.startReleaseRefresh.mockResolvedValue({ available: true, running: true, lastRun: null })
    render(<ReleaseRefreshLine />, { wrapper: enrobage })
    await userEvent.click(await screen.findByRole('button', { name: 'Mettre à jour maintenant' }))
    focusManager.setFocused(false)

    try {
      expect(await screen.findByText(/Sorties mises à jour/, {}, { timeout: 6000 })).toBeInTheDocument()
    } finally {
      focusManager.setFocused(undefined)
    }
  }, 10_000)

  it('counts "mises à jour" from the last pass that updated something, not from a skipped one', async () => {
    insights.getReleaseRefreshStatus.mockResolvedValue(
      termine({
        lastRun: { ...RUN, startedAt: ilYA(0), finishedAt: ilYA(0), origin: 'SCHEDULED', stale: 0, refreshed: 0, outcome: 'SKIPPED' },
        lastSuccessAt: ilYA(5),
      }),
    )
    render(<ReleaseRefreshLine />, { wrapper: enrobage })

    expect(
      await screen.findByText('Sorties mises à jour il y a 5 h · la mise à jour de nuit a été sautée : une autre tournait déjà'),
    ).toBeInTheDocument()
  })

  it('says when a silent source leaves the dates of the last reading, and when the next pass is planned', async () => {
    const demainMatin = new Date()
    demainMatin.setDate(demainMatin.getDate() + 1)
    demainMatin.setHours(4, 30, 0, 0)
    insights.getReleaseRefreshStatus.mockResolvedValue(
      termine({
        lastRun: { ...RUN, refreshed: 0, remaining: 3, stoppedOnUnavailableProvider: true, outcome: 'PROVIDER_SILENT' },
        lastSuccessAt: null,
        sourceSilent: true,
        nextPlannedAt: demainMatin.toISOString(),
      }),
    )
    render(<ReleaseRefreshLine />, { wrapper: enrobage })

    // One line: the next automatic pass closes the same sentence.
    expect(
      await screen.findByText(
        "Les sources de sorties n'ont pas encore répondu · une source ne répond pas : dates de la dernière lecture · 3 séries restent à relire · prochaine mise à jour automatique demain à 04:30",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Sorties mises à jour/)).not.toBeInTheDocument()
  })
})
