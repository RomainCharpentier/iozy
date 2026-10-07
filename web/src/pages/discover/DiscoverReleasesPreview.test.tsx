/**
 * <b>The latest releases, at the top of Découvrir.</b> The ten the server picks,
 * newest first, future and past mixed - and "Tout voir" to the calendar. Above
 * them, when the dates were last refreshed and the button to refresh now.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DiscoverReleasesPreview } from './DiscoverReleasesPreview'
import { typeDeCollection } from '@/test/fixtures'
import type { ReleaseEntryDto, ReleaseRefreshRunDto, ReleaseRefreshStatusDto } from '@/common/types/api'

const insights = vi.hoisted(() => ({
  getLatestReleases: vi.fn(),
  getReleaseRefreshStatus: vi.fn(),
  startReleaseRefresh: vi.fn(),
}))
vi.mock('@/common/api/insights', () => insights)
const types = vi.hoisted(() => ({ listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entityTypes', () => types)
const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

const JEU = { ...typeDeCollection('VIDEO_GAME', 'Jeu vidéo'), hasReleaseSource: true }

function sortie(entityTitle: string, date: string, precision: 'DAY' | 'MONTH' = 'DAY'): ReleaseEntryDto {
  return {
    date,
    precision,
    entityId: entityTitle,
    entityTitle,
    entityTypeId: JEU.id,
    label: '',
    volumeNumber: null,
    editionName: null,
    coverImageUrl: null,
    relation: 'WANTED',
    source: 'IGDB',
  }
}

function passe(surcharge: Partial<ReleaseRefreshRunDto> = {}): ReleaseRefreshRunDto {
  return {
    startedAt: '2026-10-04T12:00:00Z',
    finishedAt: '2026-10-04T12:01:00Z',
    origin: 'SCHEDULED',
    stale: 4,
    refreshed: 4,
    remaining: 0,
    stoppedOnUnavailableProvider: false,
    error: null,
    ...surcharge,
  }
}

function etat(surcharge: Partial<ReleaseRefreshStatusDto> = {}): ReleaseRefreshStatusDto {
  return { available: true, running: false, lastRun: passe(), ...surcharge }
}

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

/** The titles shown, top to bottom ("Tout voir" excluded). */
function titresAffiches(): string[] {
  return screen
    .getAllByRole('link')
    .filter((lien) => lien.textContent !== 'Tout voir')
    .map((lien) => /([A-Z]\d{2})/.exec(lien.textContent ?? '')?.[1] ?? '?')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  types.listEntityTypes.mockResolvedValue([JEU])
  auth.useAuth.mockReturnValue({ estInvite: false })
  insights.getLatestReleases.mockResolvedValue({ entries: [] })
  insights.getReleaseRefreshStatus.mockResolvedValue(etat())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DiscoverReleasesPreview - the ten latest', () => {
  it('shows what the server picked, in its order, asks for ten and leads to the calendar', async () => {
    insights.getLatestReleases.mockResolvedValue({
      entries: [sortie('F03', '2027-01-15'), sortie('F02', '2026-11', 'MONTH'), sortie('F01', '2026-05-20')],
    })
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByRole('link', { name: /F03/ })).toHaveAttribute('href', '/entity/F03')
    expect(titresAffiches()).toEqual(['F03', 'F02', 'F01'])
    expect(screen.getByRole('link', { name: /nov\. 2026.*F02/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tout voir' })).toHaveAttribute('href', '/releases')
    expect(insights.getLatestReleases).toHaveBeenCalledExactlyOnceWith(10)
  })

  it('says when nothing is announced, and how to follow a work', async () => {
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByText('Aucune sortie annoncée pour ta collection ni tes envies.')).toBeInTheDocument()
    expect(screen.getByText('Ajoute une œuvre à ta collection ou à tes envies, ou suis-la depuis sa fiche, pour voir ses sorties ici.')).toBeInTheDocument()
  })
})

describe('DiscoverReleasesPreview - the refresh of the dates', () => {
  it('says when the dates were last refreshed', async () => {
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByText('Sorties mises à jour il y a 3 jours')).toBeInTheDocument()
  })

  it('says it was never refreshed, which is what a machine that was off at night looks like', async () => {
    insights.getReleaseRefreshStatus.mockResolvedValue(etat({ lastRun: null }))
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByText("Les sorties n'ont jamais été mises à jour.")).toBeInTheDocument()
  })

  it('says how many series are still waiting, and when a source went silent or the pass failed', async () => {
    insights.getReleaseRefreshStatus.mockResolvedValue(
      etat({ lastRun: passe({ stale: 25, refreshed: 10, remaining: 15, stoppedOnUnavailableProvider: true }) }),
    )
    const { unmount } = render(<DiscoverReleasesPreview />, { wrapper: enrobage })
    expect(
      await screen.findByText('Sorties mises à jour il y a 3 jours · interrompue : une source ne répond plus · 15 séries restent à relire'),
    ).toBeInTheDocument()
    unmount()

    insights.getReleaseRefreshStatus.mockResolvedValue(etat({ lastRun: passe({ error: 'boom', remaining: 1 }) }))
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })
    expect(
      await screen.findByText('Sorties mises à jour il y a 3 jours · la dernière mise à jour a échoué · 1 série reste à relire'),
    ).toBeInTheDocument()
  })

  it('launches a refresh on demand, then shows that it is running and cannot be launched twice', async () => {
    insights.startReleaseRefresh.mockResolvedValue(etat({ running: true }))
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })
    const bouton = await screen.findByRole('button', { name: 'Mettre à jour maintenant' })

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(bouton)

    expect(insights.startReleaseRefresh).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Mise à jour des sorties en cours…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mettre à jour maintenant' })).toBeDisabled())
  })

  it('says so when the launch fails, instead of going back to the old date in silence', async () => {
    insights.startReleaseRefresh.mockRejectedValue(new Error('Session expirée'))
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(await screen.findByRole('button', { name: 'Mettre à jour maintenant' }))

    expect(await screen.findByText('Session expirée')).toBeInTheDocument()
  })

  it('gives a visitor the date but no button: they cannot write', async () => {
    auth.useAuth.mockReturnValue({ estInvite: true })
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByText('Sorties mises à jour il y a 3 jours')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mettre à jour maintenant' })).not.toBeInTheDocument()
  })

  it('writes nothing about a refresh when no universe can do one', async () => {
    insights.getReleaseRefreshStatus.mockResolvedValue(etat({ available: false, lastRun: null }))
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    await screen.findByText('Aucune sortie annoncée pour ta collection ni tes envies.')
    expect(screen.queryByRole('button', { name: 'Mettre à jour maintenant' })).not.toBeInTheDocument()
    expect(screen.queryByText(/mises? à jour/)).not.toBeInTheDocument()
  })
})
