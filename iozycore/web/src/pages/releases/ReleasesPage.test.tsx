/**
 * <b>The release calendar: a month as a grid, its agenda, everything that
 * is coming alongside, and what each release represents.</b>
 *
 * <p>What breaks silently here: a month misread from the URL, a
 * release put under the wrong day or missing from its cell, a relation that
 * stops being written, a chosen day that no longer clears, an empty month that
 * loses its grid, an "À venir" row that no longer brings the grid to the right
 * place.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ReleasesPage } from './ReleasesPage'
import { typeDeCollection } from '@/test/fixtures'
import { isoLocal } from '@/common/lib/releaseDate'
import type { ReleaseCalendarDto, ReleaseEntryDto } from '@/common/types/api'

const insights = vi.hoisted(() => ({ getReleaseCalendar: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)
const types = vi.hoisted(() => ({ listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entityTypes', () => types)

const MANGA = { ...typeDeCollection('MANGA', 'Manga'), hasReleaseSource: true }
const SOCIETE = typeDeCollection('BOARD_GAME', 'Jeu de société')

function sortie(surcharges: Partial<ReleaseEntryDto>): ReleaseEntryDto {
  return {
    date: '2000-01-14',
    precision: 'DAY',
    entityId: 'naruto',
    entityTitle: 'Naruto',
    entityTypeId: MANGA.id,
    label: 'Tome 72 · Kana',
    volumeNumber: 72,
    editionName: 'Kana',
    coverImageUrl: null,
    relation: 'MISSING',
    source: 'GOOGLE_BOOKS',
    ...surcharges,
  }
}

/** January 2000, as the server would return it: a release known to the month, then two days. */
const JANVIER_2000: ReleaseCalendarDto = {
  from: '2000-01-01',
  to: '2000-01-31',
  entries: [
    sortie({ date: '2000-01', precision: 'MONTH', entityId: 'spy', entityTitle: 'Spy x Family', label: 'Tome 15 · Kurokawa', relation: 'WANTED' }),
    sortie({ date: '2000-01-02', entityId: 'naruto-71', label: 'Tome 71 · Kana', relation: 'OWNED' }),
    sortie({ date: '2000-01-14' }),
    sortie({ date: '2000-01-14', entityId: 'ark', entityTitle: 'Ark Nova', entityTypeId: SOCIETE.id, label: '', relation: 'OWNED', source: 'MANUAL' }),
  ],
}

/**
 * Two requests leave the screen: the displayed month, and the coming year
 * ("À venir", from today). The requested month receives `mois`; the year
 * receives `annee`; any other month only receives what falls inside it.
 */
function servir(mois: ReleaseCalendarDto, annee: ReleaseEntryDto[] = []) {
  const aujourdHui = isoLocal(new Date())
  insights.getReleaseCalendar.mockImplementation(async (from: string, to: string) => {
    if (from === mois.from) return mois
    if (from === aujourdHui) return { from, to, entries: annee }
    return { from, to, entries: annee.filter((e) => e.date >= from.slice(0, 7) && e.date <= to) }
  })
}

function Url() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function rendre(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function enrobage({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route
              path="/releases"
              element={
                <>
                  {children}
                  <Url />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  return render(<ReleasesPage />, { wrapper: enrobage })
}

beforeEach(() => {
  vi.clearAllMocks()
  types.listEntityTypes.mockResolvedValue([MANGA, SOCIETE])
})

describe('ReleasesPage', () => {
  it('reads the month in the URL, asks the server for it bounded, and renders it as a grid then an agenda', async () => {
    servir(JANVIER_2000)
    rendre('/releases?mois=2000-01')

    expect(await screen.findByRole('heading', { name: 'Janvier 2000' })).toBeInTheDocument()
    expect(insights.getReleaseCalendar).toHaveBeenCalledWith('2000-01-01', '2000-01-31')

    // The grid: the busy days can be chosen, and say how many.
    expect(screen.getByRole('table', { name: 'Grille de janvier 2000' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'dimanche 2 janvier, 1 sortie' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'vendredi 14 janvier, 2 sorties' })).toBeInTheDocument()

    // The agenda: the days in order, and apart what has no day.
    const intertitres = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(intertitres).toEqual(['Ce mois-ci, date à préciser', 'Dimanche 2 janvier', 'Vendredi 14 janvier'])

    // The relation, always written, without the source - and the category when nothing more precise says what comes out.
    expect(screen.getByRole('link', { name: /Spy x Family.*Tome 15 · Kurokawa.*Envie/ })).toHaveAttribute('href', '/entity/spy')
    expect(screen.getByRole('link', { name: /Naruto.*Tome 71 · Kana.*Possédé/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Naruto.*Tome 72 · Kana.*À acheter/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ark Nova.*Jeu de société.*Possédé/ })).toBeInTheDocument()
    expect(screen.queryByText(/Google Books|Date saisie sur la fiche/)).not.toBeInTheDocument()

    // The month is not the one of the device: "Aujourd'hui" brings back.
    expect(screen.getByRole('button', { name: "Aujourd'hui" })).toBeInTheDocument()
  })

  it('choosing a day in the grid keeps only it, and "Tout le mois" brings back', async () => {
    servir(JANVIER_2000)
    rendre('/releases?mois=2000-01')
    const utilisateur = userEvent.setup()

    await utilisateur.click(await screen.findByRole('button', { name: 'vendredi 14 janvier, 2 sorties' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Vendredi 14 janvier'])
    expect(screen.getByRole('link', { name: /Ark Nova/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Tome 71/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Spy x Family/ })).not.toBeInTheDocument()

    await utilisateur.click(screen.getByRole('button', { name: 'Tout le mois' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Spy x Family/ })).toBeInTheDocument()
  })

  it('filters by category when there are several, and falls back on Tout', async () => {
    servir({
      from: '2000-01-01',
      to: '2000-01-31',
      entries: [sortie({}), sortie({ entityId: 'ark', entityTitle: 'Ark Nova', entityTypeId: SOCIETE.id, label: '', source: 'MANUAL' })],
    })
    rendre('/releases?mois=2000-01')
    const utilisateur = userEvent.setup()

    await screen.findByRole('link', { name: /Ark Nova/ })
    await utilisateur.click(await screen.findByRole('button', { name: /Jeu de société/ }))

    expect(screen.queryByRole('link', { name: /Naruto/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ark Nova/ })).toBeInTheDocument()
    // The grid follows the filter: the cell now only counts what remains.
    expect(screen.getByRole('button', { name: 'vendredi 14 janvier, 1 sortie' })).toBeInTheDocument()

    await utilisateur.click(screen.getByRole('button', { name: /^Tout/ }))
    expect(screen.getByRole('link', { name: /Naruto/ })).toBeInTheDocument()
  })

  it('turns the calendar pages through the URL, and forgets the chosen day when turning', async () => {
    servir(JANVIER_2000)
    rendre('/releases?mois=2000-01')
    const utilisateur = userEvent.setup()

    await utilisateur.click(await screen.findByRole('button', { name: 'dimanche 2 janvier, 1 sortie' }))
    expect(screen.getByRole('button', { name: 'Tout le mois' })).toBeInTheDocument()

    await utilisateur.click(screen.getByRole('button', { name: 'Mois suivant' }))

    expect(screen.getByTestId('url')).toHaveTextContent('/releases?mois=2000-02')
    await waitFor(() => expect(insights.getReleaseCalendar).toHaveBeenCalledWith('2000-02-01', '2000-02-29'))
    expect(screen.getByRole('heading', { name: 'Février 2000' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Grille de février 2000' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tout le mois' })).not.toBeInTheDocument()

    await utilisateur.click(screen.getByRole('button', { name: 'Mois précédent' }))
    await utilisateur.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/releases?mois=1999-12')
  })

  it('lists everything that is coming alongside, month by month, and a row brings the grid to its day', async () => {
    servir(JANVIER_2000, [
      sortie({ date: '2000-03-19', entityId: 'gta', entityTitle: 'GTA VI', label: '', entityTypeId: SOCIETE.id, relation: 'WANTED', source: 'MANUAL' }),
      sortie({ date: '2000-02', precision: 'MONTH', entityId: 'spy-16', entityTitle: 'Spy x Family', label: 'Tome 16 · Kurokawa' }),
      sortie({ date: '2000-02-03', entityId: 'naruto-73', label: 'Tome 73 · Kana' }),
    ])
    rendre('/releases?mois=2000-01')
    const utilisateur = userEvent.setup()

    const aVenir = await screen.findByRole('complementary', { name: 'À venir' })
    expect((await within(aVenir).findAllByRole('heading', { level: 3 })).map((h) => h.textContent)).toEqual(['Février 2000', 'Mars 2000'])
    const lignes = within(aVenir).getAllByRole('button').map((b) => b.textContent)
    expect(lignes[0]).toMatch(/3 févr\..*Naruto.*Tome 73/)
    expect(lignes[1]).toMatch(/à préciser.*Spy x Family/)
    expect(lignes[2]).toMatch(/19 mars.*GTA VI.*Jeu de société.*Envie/)

    await utilisateur.click(within(aVenir).getByRole('button', { name: /GTA VI/ }))

    expect(screen.getByTestId('url')).toHaveTextContent('/releases?mois=2000-03')
    expect(await screen.findByRole('button', { name: 'dimanche 19 mars, 1 sortie' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toContain('Dimanche 19 mars')
    expect(screen.getByRole('button', { name: 'Tout le mois' })).toBeInTheDocument()
  })

  it('keeps its grid when the month is empty, and says how to follow a work', async () => {
    servir({ from: '2000-01-01', to: '2000-01-31', entries: [] })
    rendre('/releases?mois=2000-01')

    expect(await screen.findByText('Rien ne sort en janvier 2000 pour ta collection ni tes envies.')).toBeInTheDocument()
    expect(screen.getByText("Ajoute une œuvre à ta collection ou à tes envies, ou suis-la depuis sa fiche, pour voir ses sorties ici.")).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Grille de janvier 2000' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sortie/ })).not.toBeInTheDocument()
    expect(await screen.findByText("Rien d'annoncé pour l'année qui vient.")).toBeInTheDocument()
  })

  it('falls back on the month of the device when the URL derails, without breaking anything', async () => {
    servir({ from: '', to: '', entries: [] })
    rendre('/releases?mois=octobre')

    await waitFor(() => expect(insights.getReleaseCalendar).toHaveBeenCalled())
    const appelDuMois = insights.getReleaseCalendar.mock.calls.find((appel) => String(appel[0]).endsWith('-01'))
    expect(appelDuMois).toBeDefined()
    const [from, to] = appelDuMois as [string, string]
    expect(from).toMatch(/^\d{4}-\d{2}-01$/)
    expect(to.slice(0, 7)).toBe(from.slice(0, 7))
    expect(screen.queryByRole('button', { name: "Aujourd'hui" })).not.toBeInTheDocument()
  })
})
