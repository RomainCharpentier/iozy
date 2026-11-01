/**
 * <b>The refresh line leaves "en cours" when the pass ends.</b> It used to
 * stay on "Mise à jour des sorties en cours…" until a reload.
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
  remaining: 0,
  refreshed: 3,
  stoppedOnUnavailableProvider: false,
  error: null,
}

describe('the release refresh line', () => {
  it('says the pass is over once the server says so, without a reload', async () => {
    insights.getReleaseRefreshStatus
      .mockResolvedValueOnce({ available: true, running: false, lastRun: null })
      .mockResolvedValueOnce({ available: true, running: true, lastRun: null })
      .mockResolvedValue({ available: true, running: false, lastRun: RUN })
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
      .mockResolvedValue({ available: true, running: false, lastRun: RUN })
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
})
