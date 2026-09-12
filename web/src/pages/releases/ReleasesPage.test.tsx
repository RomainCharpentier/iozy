/**
 * <b>Le calendrier des sorties : un mois en grille, son agenda, tout ce qui
 * vient à côté, et ce que chaque sortie représente.</b>
 *
 * <p>Ce qui se casse en silence ici : un mois lu de travers dans l'URL, une
 * sortie rangée sous le mauvais jour ou absente de sa case, une relation qui
 * cesse d'être écrite, un jour choisi qui ne s'efface plus, un mois vide qui
 * perd sa grille, une ligne d'« À venir » qui n'amène plus la grille au bon
 * endroit.
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

/** Janvier 2000, tel que le serveur le rendrait : une sortie au mois près, puis deux jours. */
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
 * Deux requêtes partent de l'écran : le mois affiché, et l'année à venir
 * (« À venir », depuis aujourd'hui). Le mois demandé reçoit `mois` ; l'année
 * reçoit `annee` ; tout autre mois n'en reçoit que ce qui tombe dedans.
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
  it('lit le mois dans l’URL, le demande au serveur borné, et le rend en grille puis en agenda', async () => {
    servir(JANVIER_2000)
    rendre('/releases?mois=2000-01')

    expect(await screen.findByRole('heading', { name: 'Janvier 2000' })).toBeInTheDocument()
    expect(insights.getReleaseCalendar).toHaveBeenCalledWith('2000-01-01', '2000-01-31')

    // La grille : les jours chargés se choisissent, et disent combien.
    expect(screen.getByRole('table', { name: 'Grille de janvier 2000' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'dimanche 2 janvier, 1 sortie' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'vendredi 14 janvier, 2 sorties' })).toBeInTheDocument()

    // L'agenda : les jours dans l'ordre, et à part ce qui n'a pas de jour.
    const intertitres = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(intertitres).toEqual(['Ce mois-ci, date à préciser', 'Dimanche 2 janvier', 'Vendredi 14 janvier'])

    // La relation, toujours écrite, sans la source - et la catégorie quand rien de plus précis ne dit ce qui sort.
    expect(screen.getByRole('link', { name: /Spy x Family.*Tome 15 · Kurokawa.*Envie/ })).toHaveAttribute('href', '/entity/spy')
    expect(screen.getByRole('link', { name: /Naruto.*Tome 71 · Kana.*Possédé/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Naruto.*Tome 72 · Kana.*À acheter/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ark Nova.*Jeu de société.*Possédé/ })).toBeInTheDocument()
    expect(screen.queryByText(/Google Books|Date saisie sur la fiche/)).not.toBeInTheDocument()

    // Le mois n'est pas celui de l'appareil : « Aujourd'hui » ramène.
    expect(screen.getByRole('button', { name: "Aujourd'hui" })).toBeInTheDocument()
  })

  it('choisir un jour dans la grille ne garde que lui, et « Tout le mois » ramène', async () => {
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

  it('filtre par catégorie quand il y en a plusieurs, et retombe sur Tout', async () => {
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
    // La grille suit le filtre : la case ne compte plus que ce qui reste.
    expect(screen.getByRole('button', { name: 'vendredi 14 janvier, 1 sortie' })).toBeInTheDocument()

    await utilisateur.click(screen.getByRole('button', { name: /^Tout/ }))
    expect(screen.getByRole('link', { name: /Naruto/ })).toBeInTheDocument()
  })

  it('tourne les pages du calendrier par l’URL, et oublie le jour choisi en tournant', async () => {
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

  it('liste tout ce qui vient à côté, mois par mois, et une ligne amène la grille sur son jour', async () => {
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

  it('garde sa grille quand le mois est vide, et dit comment suivre une œuvre', async () => {
    servir({ from: '2000-01-01', to: '2000-01-31', entries: [] })
    rendre('/releases?mois=2000-01')

    expect(await screen.findByText('Rien ne sort en janvier 2000 pour les œuvres que tu suis.')).toBeInTheDocument()
    expect(screen.getByText("Suis une œuvre depuis sa fiche pour voir ses sorties ici.")).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Grille de janvier 2000' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sortie/ })).not.toBeInTheDocument()
    expect(await screen.findByText("Rien d'annoncé pour l'année qui vient.")).toBeInTheDocument()
  })

  it('retombe sur le mois de l’appareil quand l’URL déraille, sans rien casser', async () => {
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
