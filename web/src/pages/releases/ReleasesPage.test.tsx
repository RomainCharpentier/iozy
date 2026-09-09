/**
 * <b>Le calendrier des sorties : un mois, ses jours, ce que chaque sortie
 * représente.</b>
 *
 * <p>Ce qui se casse en silence ici : un mois lu de travers dans l'URL, une
 * sortie rangée sous le mauvais jour, une relation qui cesse d'être écrite, un
 * mois vide qui ne dit plus d'où viendraient les dates.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ReleasesPage } from './ReleasesPage'
import { typeDeCollection } from '@/test/fixtures'
import type { ReleaseEntryDto } from '@/common/types/api'

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
  it('lit le mois dans l’URL, le demande au serveur borné, et range les sorties par jour', async () => {
    insights.getReleaseCalendar.mockResolvedValue({
      from: '2000-01-01',
      to: '2000-01-31',
      entries: [
        sortie({ date: '2000-01', precision: 'MONTH', entityId: 'spy', entityTitle: 'Spy x Family', label: 'Tome 15 · Kurokawa', relation: 'WANTED' }),
        sortie({ date: '2000-01-02', entityId: 'naruto-71', label: 'Tome 71 · Kana', relation: 'OWNED' }),
        sortie({ date: '2000-01-14' }),
        sortie({ date: '2000-01-14', entityId: 'ark', entityTitle: 'Ark Nova', entityTypeId: SOCIETE.id, label: '', relation: 'OWNED', source: 'MANUAL' }),
      ],
    })
    rendre('/releases?mois=2000-01')

    expect(await screen.findByRole('heading', { name: 'Janvier 2000' })).toBeInTheDocument()
    expect(insights.getReleaseCalendar).toHaveBeenCalledWith('2000-01-01', '2000-01-31')

    // Les jours, dans l'ordre, et à part ce qui n'a pas de jour.
    const intertitres = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent)
    expect(intertitres).toEqual(['Dans le mois, date à préciser', 'dimanche 2 janvier', 'vendredi 14 janvier'])

    // La relation, toujours écrite - et la catégorie quand rien de plus précis ne dit ce qui sort.
    expect(screen.getByRole('link', { name: /Spy x Family.*Tome 15 · Kurokawa.*Google Books.*Envie/ })).toHaveAttribute('href', '/entity/spy')
    expect(screen.getByRole('link', { name: /Naruto.*Tome 71 · Kana.*Possédé/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Naruto.*Tome 72 · Kana.*Manquant/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ark Nova.*Jeu de société.*Date saisie sur la fiche.*Possédé/ })).toBeInTheDocument()

    // Le mois n'est pas celui de l'appareil : « Aujourd'hui » ramène.
    expect(screen.getByRole('button', { name: "Aujourd'hui" })).toBeInTheDocument()
  })

  it('filtre par catégorie quand il y en a plusieurs, et retombe sur Tout', async () => {
    insights.getReleaseCalendar.mockResolvedValue({
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

    await utilisateur.click(screen.getByRole('button', { name: /^Tout/ }))
    expect(screen.getByRole('link', { name: /Naruto/ })).toBeInTheDocument()
  })

  it('tourne les pages du calendrier par l’URL', async () => {
    insights.getReleaseCalendar.mockResolvedValue({ from: '2000-01-01', to: '2000-01-31', entries: [] })
    rendre('/releases?mois=2000-01')
    const utilisateur = userEvent.setup()

    await screen.findByRole('heading', { name: 'Janvier 2000' })
    await utilisateur.click(screen.getByRole('button', { name: 'Mois suivant' }))

    expect(screen.getByTestId('url')).toHaveTextContent('/releases?mois=2000-02')
    await waitFor(() => expect(insights.getReleaseCalendar).toHaveBeenCalledWith('2000-02-01', '2000-02-29'))
    expect(screen.getByRole('heading', { name: 'Février 2000' })).toBeInTheDocument()

    await utilisateur.click(screen.getByRole('button', { name: 'Mois précédent' }))
    await utilisateur.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/releases?mois=1999-12')
  })

  it('dit d’où viendraient les dates quand le mois est vide', async () => {
    insights.getReleaseCalendar.mockResolvedValue({ from: '2000-01-01', to: '2000-01-31', entries: [] })
    rendre('/releases?mois=2000-01')

    expect(await screen.findByText('Rien de prévu en janvier 2000 pour tes collections.')).toBeInTheDocument()
    expect(
      await screen.findByText(
        "Les dates de Manga viennent de leurs sources, pour ce que tu possèdes ou veux. Pour Jeu de société, renseigne « Date de sortie » sur la fiche d'une œuvre.",
      ),
    ).toBeInTheDocument()
  })

  it('retombe sur le mois de l’appareil quand l’URL déraille, sans rien casser', async () => {
    insights.getReleaseCalendar.mockResolvedValue({ from: '', to: '', entries: [] })
    rendre('/releases?mois=octobre')

    await waitFor(() => expect(insights.getReleaseCalendar).toHaveBeenCalled())
    const [from, to] = insights.getReleaseCalendar.mock.calls[0]
    expect(from).toMatch(/^\d{4}-\d{2}-01$/)
    expect(to.slice(0, 7)).toBe(from.slice(0, 7))
    expect(screen.queryByRole('button', { name: "Aujourd'hui" })).not.toBeInTheDocument()
  })
})
