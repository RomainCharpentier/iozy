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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ShelfPage } from './ShelfPage'
import { oeuvre, possession, tag, tome, typeDeCollection } from '@/test/fixtures'

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
  await userEvent.click(screen.getByRole('button', { name: /Affichage/ }))
  await userEvent.click(await screen.findByRole('radio', { name: nomDuTag }))
}

describe('the tag filter', () => {
  it("keeps only the works that carry the tag", async () => {
    render(<ShelfPage />, { wrapper: enrobage })
    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vagabond/ })).toBeInTheDocument()

    await filtrerSur('Lu')

    await waitFor(() => expect(screen.queryByRole('button', { name: /Vagabond/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
  })

  it('counts in the badge of the Affichage button', async () => {
    render(<ShelfPage />, { wrapper: enrobage })

    await filtrerSur('Lu')

    // The badge announced "1" hard-coded, whatever the number of filters
    // set: it now counts.
    expect(screen.getByRole('button', { name: /Affichage/ })).toHaveTextContent('1')
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
