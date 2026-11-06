/**
 * <b>My collection, filtered by tag.</b>
 *
 * <p>The panel has its own tests ({@code CollectionFilters.test.tsx}): it
 * lists the tags and reports the one that is chosen. What it cannot prove
 * is that the screen <b>uses</b> it - a `porteLeTag` forgotten in the filtering
 * leaves a perfectly working panel in front of a grid that does not move.
 * This is exactly the state in which tags have lived until now:
 * possible to set, and without effect.
 *
 * <p>The data comes from {@code useDonneesCollection}, replaced here: this
 * hook has its four queries and its own contract, and this test is about
 * the filtering, not about the loading.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ShelfPage } from './ShelfPage'
import { edition, oeuvre, possession, progressionDe, tag, tome, typeDeCollection } from '@/test/fixtures'

const apiTags = vi.hoisted(() => ({ listTags: vi.fn(), createTag: vi.fn(), attachTag: vi.fn(), detachTag: vi.fn() }))
vi.mock('@/common/api/tags', () => apiTags)

const donnees = vi.hoisted(() => ({ useDonneesCollection: vi.fn() }))
vi.mock('./useDonneesCollection', () => donnees)

const LU = tag('Lu')
const MANGA = typeDeCollection('MANGA', 'Manga')

const BERSERK = oeuvre({ titre: 'Berserk', typeId: MANGA.id, tomes: [tome(1)], tags: [LU.id] })
const VAGABOND = oeuvre({ titre: 'Vagabond', typeId: MANGA.id, tomes: [tome(1)] })

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  apiTags.listTags.mockResolvedValue([LU])
  const possessions = [
    possession({ entityId: BERSERK.id, variantId: 'tome-1' }),
    possession({ entityId: VAGABOND.id, variantId: 'tome-1' }),
  ]
  donnees.useDonneesCollection.mockReturnValue({
    entities: [BERSERK, VAGABOND],
    entityTypes: [MANGA],
    ownerships: possessions,
    progression: new Map(),
    // Both works are owned: without that, the All/Owned/Wishes filter
    // would remove them before the tag even has its say, and the test
    // would pass for the wrong reason.
    owned: new Set(['tome-1']),
    oeuvresVoulues: new Set<string>(),
    oeuvresSuivies: new Set<string>(),
    tomesVoulus: new Set<string>(),
    wishlist: { entries: [], variantsVoulus: new Set<string>(), isLoading: false },
    chargement: false,
    listeChargee: true,
    erreurs: [],
  })
})

/** Opens the panel and chooses a tag - the complete gesture, from the screen. */
async function filtrerSur(nomDuTag: string) {
  await userEvent.click(await screen.findByRole('button', { name: /Filtres/ }))
  await userEvent.click(await screen.findByRole('radio', { name: nomDuTag }))
}

/** A second category next to the mangas, with the data the page reads. */
const JEU = typeDeCollection('VIDEO_GAME', 'Jeu vidéo')
const HADES = oeuvre({ titre: 'Hades', typeId: JEU.id })
const CELESTE = oeuvre({ titre: 'Celeste', typeId: JEU.id })
const ALIEN = oeuvre({ titre: 'Alien', typeId: JEU.id })

function avecLesJeux() {
  const base = donnees.useDonneesCollection()
  donnees.useDonneesCollection.mockReturnValue({
    ...base,
    entities: [...base.entities, HADES, CELESTE, ALIEN],
    entityTypes: [MANGA, JEU],
    ownerships: [...base.ownerships, ...[HADES, CELESTE, ALIEN].map((j) => possession({ entityId: j.id }))],
  })
}

function queLesJeux() {
  donnees.useDonneesCollection.mockReturnValue({
    ...donnees.useDonneesCollection(),
    entities: [HADES, CELESTE],
    entityTypes: [MANGA, JEU],
    ownerships: [HADES, CELESTE].map((j) => possession({ entityId: j.id })),
    owned: new Set<string>(),
  })
}

describe('the rooms', () => {
  it('opens one room per category, the fullest first, each with its name', () => {
    avecLesJeux()
    render(<ShelfPage />, { wrapper: enrobage })

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Jeu vidéo', 'Manga'])
    expect(screen.getByRole('navigation', { name: 'Catégories' })).toHaveTextContent('Jeu vidéo3')
  })

  it('with one category, says neither its name nor a bar: the page already is that room', () => {
    render(<ShelfPage />, { wrapper: enrobage })

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Catégories' })).not.toBeInTheDocument()
  })

  it('keeps a work in a decided place: by title', () => {
    avecLesJeux()
    render(<ShelfPage />, { wrapper: enrobage })
    const salle = screen.getByRole('region', { name: 'Jeu vidéo' })

    const titres = within(salle).getAllByRole('button').map((b) => b.getAttribute('title'))

    expect(titres).toEqual(['Alien', 'Celeste', 'Hades'])
  })

  it('keeps the name of the rooms when a tag leaves only one of them', async () => {
    avecLesJeux()
    render(<ShelfPage />, { wrapper: enrobage })

    await filtrerSur('Lu')

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Jeu vidéo' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 2, name: 'Manga' })).toBeInTheDocument()
  })

  it('leaves the tools of a category within reach', () => {
    render(<ShelfPage />, { wrapper: enrobage })

    expect(screen.getByRole('link', { name: 'Voir le rayon' })).toHaveAttribute('href', `/collection/${MANGA.id}`)
  })

  it('offers no way to choose another order', () => {
    render(<ShelfPage />, { wrapper: enrobage })

    expect(screen.queryByText('Trier')).not.toBeInTheDocument()
    expect(screen.queryByText('Regrouper')).not.toBeInTheDocument()
  })
})

describe('the view', () => {
  it('remembers the compact view from one visit to the next', async () => {
    const { unmount } = render(<ShelfPage />, { wrapper: enrobage })

    await userEvent.click(screen.getByRole('radio', { name: 'Compact' }))
    unmount()
    render(<ShelfPage />, { wrapper: enrobage })

    expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked()
  })

  it('keeps every work in both views', async () => {
    render(<ShelfPage />, { wrapper: enrobage })

    await userEvent.click(screen.getByRole('radio', { name: 'Compact' }))

    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vagabond/ })).toBeInTheDocument()
  })
})

describe('"À compléter"', () => {
  it('keeps only the owned series that lack a volume', async () => {
    donnees.useDonneesCollection.mockReturnValue({
      ...donnees.useDonneesCollection(),
      progression: new Map([
        ...progressionDe(BERSERK, edition({ possedes: [1], total: 3 })),
        ...progressionDe(VAGABOND, edition({ possedes: [1], total: 1 })),
      ]),
    })
    render(<ShelfPage />, { wrapper: enrobage })

    await userEvent.click(screen.getByRole('radio', { name: /À compléter/ }))

    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Vagabond/ })).not.toBeInTheDocument()
  })

  it('is not offered to a collection without volumes, even when it was remembered', () => {
    localStorage.setItem('iozycore.preferencesCollection', JSON.stringify({ filtre: 'completer' }))
    queLesJeux()
    render(<ShelfPage />, { wrapper: enrobage })

    expect(screen.queryByRole('radio', { name: /À compléter/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hades/ })).toBeInTheDocument()
  })
})

describe('the tag filter', () => {
  it("keeps only the works that carry the tag", async () => {
    render(<ShelfPage />, { wrapper: enrobage })
    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vagabond/ })).toBeInTheDocument()

    await filtrerSur('Lu')

    await waitFor(() => expect(screen.queryByRole('button', { name: /Vagabond/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
  })

  it('counts in the badge of the Filtres button', async () => {
    render(<ShelfPage />, { wrapper: enrobage })

    await filtrerSur('Lu')

    // The badge announced "1" hard-coded, whatever the number of filters
    // set: it now counts.
    expect(screen.getByRole('button', { name: /Filtres/ })).toHaveTextContent('1')
  })

  it('is released when going back to "Tous"', async () => {
    render(<ShelfPage />, { wrapper: enrobage })
    await filtrerSur('Lu')
    await waitFor(() => expect(screen.queryByRole('button', { name: /Vagabond/ })).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('radio', { name: 'Tous' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Vagabond/ })).toBeInTheDocument())
  })

  it('leaves an empty screen that says why, and how to get out of it', async () => {
    donnees.useDonneesCollection.mockReturnValue({
      ...donnees.useDonneesCollection(),
      entities: [VAGABOND], // no work carries the tag
    })
    render(<ShelfPage />, { wrapper: enrobage })

    await filtrerSur('Lu')

    expect(await screen.findByText('Rien ne correspond à ces filtres.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réinitialiser les filtres' })).toBeInTheDocument()
  })
})
