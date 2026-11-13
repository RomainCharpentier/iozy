/**
 * <b>Sorties: a timeline around today, what comes out in the order of its
 * dates, filters read from the data, and the agenda subscription.</b>
 *
 * <p>What breaks silently here: releases out of order or with the wrong days, a category
 * that gets no chip because it is not one of the known universes, a missing
 * release that no longer offers the pre-order, an owned one that offers it,
 * an empty year that says "nothing" when the sources were never read, a
 * subscription link written with the wrong scheme.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ReleasesPage } from './ReleasesPage'
import { liensAbonnement } from './releaseCalendar'
import { typeDeCollection } from '@/test/fixtures'
import { isoLocal } from '@/common/lib/releaseDate'
import type { ReleaseEntryDto } from '@/common/types/api'

const insights = vi.hoisted(() => ({ getReleaseCalendar: vi.fn(), getReleaseRefreshStatus: vi.fn(), startReleaseRefresh: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)
const types = vi.hoisted(() => ({ listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entityTypes', () => types)
const entities = vi.hoisted(() => ({ quickAdd: vi.fn() }))
vi.mock('@/common/api/entities', () => entities)
const calendar = vi.hoisted(() => ({ subscribeToCalendar: vi.fn(), revokeCalendarSubscription: vi.fn() }))
vi.mock('@/common/api/calendar', () => calendar)
const auth = vi.hoisted(() => ({ estInvite: false }))
vi.mock('@/common/hooks/useAuth', () => ({ useAuth: () => auth }))

const MANGA = { ...typeDeCollection('MANGA', 'Manga'), hasReleaseSource: true }
/** A type the owner made: nothing in the code knows it. */
const VINYLE = typeDeCollection('VINYLE_42', 'Vinyle')

/** A day from today, as the server writes it. */
function dans(jours: number): string {
  const d = new Date()
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + jours))
}

function sortie(surcharges: Partial<ReleaseEntryDto>): ReleaseEntryDto {
  return {
    date: dans(5),
    precision: 'DAY',
    entityId: 'vinland',
    entityTitle: 'Vinland Saga',
    entityTypeId: MANGA.id,
    label: 'Tome 15 · Kurokawa',
    volumeNumber: 15,
    editionName: 'Kurokawa',
    coverImageUrl: null,
    relation: 'MISSING',
    source: 'GOOGLE_BOOKS',
    ...surcharges,
  }
}

const VINLAND = sortie({})
const DISQUE = sortie({ date: dans(40), entityId: 'ram', entityTitle: 'Random Access Memories', entityTypeId: VINYLE.id, label: '', volumeNumber: null, editionName: null, relation: 'OWNED', source: 'MANUAL' })
const FRIEREN = sortie({ date: dans(12), entityId: 'frieren', entityTitle: 'Frieren', label: 'Tome 15 · Ki-oon', editionName: 'Ki-oon', relation: 'WANTED' })

function servir(entries: ReleaseEntryDto[]) {
  insights.getReleaseCalendar.mockImplementation(async (from: string, to: string) => ({ from, to, entries }))
}

function rendre() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  function enrobage({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/releases']}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
  return render(<ReleasesPage />, { wrapper: enrobage })
}

/** What the timeline says comes out, in its order: the name each release gives a screen reader. */
async function ceQuiSort(): Promise<string[]> {
  const liste = await screen.findByRole('list', { name: 'Ce qui sort' })
  return within(liste)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('a, button')?.getAttribute('aria-label') ?? '')
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.estInvite = false
  types.listEntityTypes.mockResolvedValue([MANGA, VINYLE])
  insights.getReleaseRefreshStatus.mockResolvedValue({ available: false, running: false, lastRun: null })
})

describe('ReleasesPage', () => {
  it('sets what comes out in the order of the dates, with its days, and asks the server for the coming year', async () => {
    servir([DISQUE, FRIEREN, VINLAND])
    rendre()

    expect(await ceQuiSort()).toEqual([
      "Vinland Saga, Tome 15 · Kurokawa, dans 5 jours : je l'ai précommandé",
      "Frieren, Tome 15 · Ki-oon, dans 12 jours : je l'ai précommandé",
      'Random Access Memories, dans 40 jours',
    ])
    expect(insights.getReleaseCalendar).toHaveBeenCalledWith(dans(0), expect.any(String))
  })

  it('offers one chip per category that has a release, a custom type included', async () => {
    servir([VINLAND, FRIEREN, DISQUE])
    rendre()

    const filtres = await screen.findByRole('group', { name: 'Filtrer par catégorie' })
    expect(within(filtres).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tout3', 'Manga2', 'Vinyle1'])

    await userEvent.click(within(filtres).getByRole('button', { name: /Vinyle/ }))
    // Filtered on the vinyl, the timeline keeps the record only.
    expect(await ceQuiSort()).toEqual(['Random Access Memories, dans 40 jours'])
  })

  it('pre-orders a missing release in one click through quick-add, and leaves an owned one as a link', async () => {
    entities.quickAdd.mockResolvedValue({ entityId: 'frieren', matchedExistingEntity: true, variantId: 'v', matchedExistingVariant: false })
    servir([VINLAND, FRIEREN, DISQUE])
    rendre()

    const frieren = await screen.findByRole('button', { name: /^Frieren, Tome 15 · Ki-oon, .* : je l'ai précommandé$/ })
    await userEvent.click(frieren)
    expect(entities.quickAdd).toHaveBeenCalledWith({
      entityTypeId: MANGA.id,
      title: 'Frieren',
      condition: 'NEW',
      volumeNumber: 15,
      edition: 'Ki-oon',
    })

    expect(screen.getByRole('link', { name: 'Random Access Memories, dans 40 jours' })).toHaveAttribute('href', '/entity/ram')
    expect(screen.queryByRole('button', { name: /Random Access Memories.*je l'ai/ })).not.toBeInTheDocument()
  })

  it('lets a guest look without writing', async () => {
    auth.estInvite = true
    servir([VINLAND, FRIEREN])
    rendre()

    expect(await screen.findByRole('link', { name: /^Frieren, Tome 15/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /je l'ai précommandé/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "S'abonner dans mon agenda" })).not.toBeInTheDocument()
  })

  it('tells an empty year apart from sources never read', async () => {
    servir([])
    insights.getReleaseRefreshStatus.mockResolvedValue({ available: true, running: false, lastRun: null })
    rendre()
    expect(await screen.findByText("Les sources de sorties n'ont pas encore été consultées.")).toBeInTheDocument()
    expect(screen.getByText("Les sorties n'ont pas encore été cherchées.")).toBeInTheDocument()
  })

  it('does not send a guest to a refresh button they do not have', async () => {
    auth.estInvite = true
    servir([])
    insights.getReleaseRefreshStatus.mockResolvedValue({ available: true, running: false, lastRun: null })
    rendre()
    expect(await screen.findByText("Les sources n'ont pas encore été lues.")).toBeInTheDocument()
    expect(screen.queryByText(/Lance une mise à jour/)).not.toBeInTheDocument()
  })

  it('says nothing is announced when the sources were read', async () => {
    servir([])
    rendre()
    expect(await screen.findByText("Rien d'annoncé pour l'année qui vient.")).toBeInTheDocument()
  })

  it('shows the error of the server', async () => {
    insights.getReleaseCalendar.mockRejectedValue(new Error('Le serveur ne répond pas.'))
    rendre()
    expect(await screen.findByText('Le serveur ne répond pas.')).toBeInTheDocument()
  })

  it('gives the subscription links, and draws a new one on demand', async () => {
    servir([VINLAND])
    calendar.subscribeToCalendar
      .mockResolvedValueOnce({ token: 'abc', feedPath: '/api/public/calendar/abc.ics', createdAt: '2026-11-08T10:00:00Z' })
      .mockResolvedValueOnce({ token: 'xyz', feedPath: '/api/public/calendar/xyz.ics', createdAt: '2026-11-08T11:00:00Z' })
    calendar.revokeCalendarSubscription.mockResolvedValue(undefined)
    rendre()

    await userEvent.click(await screen.findByRole('button', { name: "S'abonner dans mon agenda" }))
    const webcal = await screen.findByRole('textbox', { name: 'Lien webcal://' })
    expect(webcal).toHaveValue(`webcal://${window.location.host}/api/public/calendar/abc.ics`)
    expect(screen.getByRole('textbox', { name: 'Lien https://' })).toHaveValue(`${window.location.origin}/api/public/calendar/abc.ics`)

    // Two steps: the first click only asks, and "Annuler" leaves the link alive.
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau lien' }))
    expect(screen.getByText("Couper l'ancien lien ?")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(calendar.revokeCalendarSubscription).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Nouveau lien' }))
    await userEvent.click(screen.getByRole('button', { name: "Oui, couper l'ancien lien" }))
    expect(await screen.findByDisplayValue(`${window.location.origin}/api/public/calendar/xyz.ics`)).toBeInTheDocument()
    expect(calendar.revokeCalendarSubscription).toHaveBeenCalledTimes(1)
  })

  it('never leaves a revoked link on screen when the new one fails, and tries again', async () => {
    servir([VINLAND])
    calendar.subscribeToCalendar
      .mockResolvedValueOnce({ token: 'abc', feedPath: '/api/public/calendar/abc.ics', createdAt: '2026-11-08T10:00:00Z' })
      .mockRejectedValueOnce(new Error('Le serveur ne répond pas.'))
      .mockResolvedValueOnce({ token: 'xyz', feedPath: '/api/public/calendar/xyz.ics', createdAt: '2026-11-08T11:00:00Z' })
    calendar.revokeCalendarSubscription.mockResolvedValue(undefined)
    rendre()

    await userEvent.click(await screen.findByRole('button', { name: "S'abonner dans mon agenda" }))
    await screen.findByRole('textbox', { name: 'Lien webcal://' })
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau lien' }))
    await userEvent.click(screen.getByRole('button', { name: "Oui, couper l'ancien lien" }))

    expect(await screen.findByText('Le serveur ne répond pas.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Copier/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByDisplayValue(`${window.location.origin}/api/public/calendar/xyz.ics`)).toBeInTheDocument()
    expect(screen.queryByText('Le serveur ne répond pas.')).not.toBeInTheDocument()
    expect(calendar.revokeCalendarSubscription).toHaveBeenCalledTimes(1)
  })
})

describe('liensAbonnement', () => {
  it('writes the same feed as https:// and webcal://', () => {
    expect(liensAbonnement('/api/public/calendar/t.ics', 'https://iozy.example')).toEqual({
      https: 'https://iozy.example/api/public/calendar/t.ics',
      webcal: 'webcal://iozy.example/api/public/calendar/t.ics',
    })
    expect(liensAbonnement('/api/public/calendar/t.ics', 'http://localhost:5173').webcal).toBe('webcal://localhost:5173/api/public/calendar/t.ics')
  })
})
