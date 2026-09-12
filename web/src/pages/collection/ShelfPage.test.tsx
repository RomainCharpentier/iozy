/**
 * <b>Ma collection, filtrée par tag.</b>
 *
 * <p>Le panneau a ses propres tests ({@code CollectionFilters.test.tsx}) : il
 * liste les tags et remonte celui qu'on choisit. Ce qu'il ne peut pas prouver,
 * c'est que l'écran s'en <b>serve</b> - un `porteLeTag` oublié dans le filtrage
 * laisse un panneau parfaitement fonctionnel devant une grille qui ne bouge
 * pas. C'est exactement l'état dans lequel les tags ont vécu jusqu'ici :
 * posables, et sans effet.
 *
 * <p>Les données viennent de {@code useDonneesCollection}, remplacé ici : ce
 * hook a ses quatre requêtes et son propre contrat, et ce test parle du
 * filtrage, pas du chargement.
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
    // Les deux œuvres sont possédées : sans ça, le filtre Tout/Possédés/Envies
    // les écarterait avant même que le tag ait son mot à dire, et le test
    // passerait pour la mauvaise raison.
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

/** Ouvre le panneau et choisit un tag - le geste complet, depuis l'écran. */
async function filtrerSur(nomDuTag: string) {
  await userEvent.click(screen.getByRole('button', { name: /Filtres/ }))
  await userEvent.click(await screen.findByRole('radio', { name: nomDuTag }))
}

describe('le filtre par tag', () => {
  it("ne retient que les œuvres qui portent le tag", async () => {
    render(<ShelfPage />, { wrapper: enrobage })
    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vagabond/ })).toBeInTheDocument()

    await filtrerSur('Lu')

    await waitFor(() => expect(screen.queryByRole('button', { name: /Vagabond/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Berserk/ })).toBeInTheDocument()
  })

  it('compte dans la pastille du bouton Filtres', async () => {
    render(<ShelfPage />, { wrapper: enrobage })

    await filtrerSur('Lu')

    // La pastille annonçait « 1 » en dur, quel que soit le nombre de filtres
    // posés : elle compte désormais.
    expect(screen.getByRole('button', { name: /Filtres/ })).toHaveTextContent('1')
  })

  it('se relâche quand on revient à « Tous »', async () => {
    render(<ShelfPage />, { wrapper: enrobage })
    await filtrerSur('Lu')
    await waitFor(() => expect(screen.queryByRole('button', { name: /Vagabond/ })).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('radio', { name: 'Tous' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Vagabond/ })).toBeInTheDocument())
  })

  it('laisse un écran vide qui dit pourquoi, et par où en sortir', async () => {
    donnees.useDonneesCollection.mockReturnValue({
      ...donnees.useDonneesCollection(),
      entities: [VAGABOND], // aucune œuvre ne porte le tag
    })
    render(<ShelfPage />, { wrapper: enrobage })

    await filtrerSur('Lu')

    expect(await screen.findByText('Rien ne correspond à ces filtres.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réinitialiser les filtres' })).toBeInTheDocument()
  })
})
