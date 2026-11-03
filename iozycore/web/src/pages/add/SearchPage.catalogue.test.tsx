/**
 * <b>The catalog as a visitor reads it: what the screen offers, and what it
 * says when there is nothing.</b>
 *
 * <p>Three rules that broke without a sound:
 * <ul>
 *   <li>the barcode lookup only knows books - offered under "Jeu vidéo", it
 *       sent a manga ISBN with the wrong type and answered "no match";</li>
 *   <li>an empty list was an empty page: no word to tell "nothing" from
 *       "still loading";</li>
 *   <li>an ISBN found by a visitor led to a screen the visitor could not
 *       reach, and the result disappeared.</li>
 * </ul>
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchPage } from './SearchPage'
import { oeuvre, possession, tome, typeDeCollection } from '@/test/fixtures'

const metadata = vi.hoisted(() => ({
  searchMetadata: vi.fn(),
  fetchFrenchTitle: vi.fn(),
  seriesSansTomesConnues: vi.fn(),
  lookupBarcode: vi.fn(),
}))
vi.mock('@/common/api/metadata', () => metadata)

const api = vi.hoisted(() => ({ searchEntities: vi.fn(), listAllOwnerships: vi.fn(), listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entities', () => ({ searchEntities: api.searchEntities }))
vi.mock('@/common/api/ownerships', () => ({ listAllOwnerships: api.listAllOwnerships }))
vi.mock('@/common/api/entityTypes', () => ({ listEntityTypes: api.listEntityTypes }))
vi.mock('@/common/api/tags', () => ({ listTags: vi.fn().mockResolvedValue([]) }))
const wishlist = vi.hoisted(() => ({ entries: [] as { id: string; entityId: string; variantId: null; addedAt: string }[] }))
vi.mock('@/common/hooks/useWishlist', () => ({
  useWishlist: () => ({
    entries: wishlist.entries,
    variantsVoulus: new Set(),
    isLoading: false,
    entryFor: (entityId: string) => wishlist.entries.find((entry) => entry.entityId === entityId),
  }),
}))

const auth = vi.hoisted(() => ({ estInvite: true }))
vi.mock('@/common/hooks/useAuth', () => ({ useAuth: () => ({ estInvite: auth.estInvite }) }))

const MANGA = { ...typeDeCollection('MANGA', 'Manga'), hasMetadataProvider: true }
const JEU_VIDEO = { ...typeDeCollection('VIDEO_GAME', 'Jeu vidéo'), hasMetadataProvider: true }

/** Where the screen led: the preview route only says its own address. */
function Apercu() {
  const { pathname, search } = useLocation()
  return <p>Aperçu ouvert : {`${pathname}${search}`}</p>
}

function rendre() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/add']}>
        <Routes>
          <Route path="/add" element={<SearchPage />} />
          <Route path="/apercu" element={<Apercu />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.estInvite = true
  wishlist.entries = []
  api.listEntityTypes.mockResolvedValue([MANGA, JEU_VIDEO])
  api.searchEntities.mockResolvedValue([])
  api.listAllOwnerships.mockResolvedValue([])
  metadata.searchMetadata.mockResolvedValue([])
  metadata.fetchFrenchTitle.mockResolvedValue(null)
  metadata.seriesSansTomesConnues.mockResolvedValue([])
})

describe('the barcode scan', () => {
  it('is offered under Manga, and only there', async () => {
    rendre()
    await userEvent.click(await screen.findByRole('button', { name: 'Manga' }))
    expect(screen.getByRole('button', { name: 'Scanner un code-barres / ISBN' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Jeu vidéo' }))
    expect(screen.queryByRole('button', { name: 'Scanner un code-barres / ISBN' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tout' }))
    expect(screen.queryByRole('button', { name: 'Scanner un code-barres / ISBN' })).not.toBeInTheDocument()
  })

  it('leads a visitor to the preview of the work found, with the manga type', async () => {
    metadata.lookupBarcode.mockResolvedValue({
      externalId: 'ol-1',
      source: 'OPEN_LIBRARY',
      title: 'One Piece Tome 01',
      imageUrl: null,
      attributes: {},
    })
    rendre()
    await userEvent.click(await screen.findByRole('button', { name: 'Manga' }))
    await userEvent.click(screen.getByRole('button', { name: 'Scanner un code-barres / ISBN' }))
    await userEvent.type(screen.getByLabelText('Code-barres / ISBN'), '9782723488525')
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(metadata.lookupBarcode).toHaveBeenCalledWith(MANGA.id, '9782723488525')
    expect(await screen.findByText(/Aperçu ouvert : \/apercu\?type=/)).toHaveTextContent(
      `type=${MANGA.id}&titre=One%20Piece%20Tome%2001`,
    )
  })
})

describe('an empty catalog list', () => {
  it('says that nothing matches the title typed', async () => {
    rendre()
    await userEvent.type(await screen.findByLabelText('Titre'), 'zzzzqq')

    expect(await screen.findByText('Aucune œuvre ne correspond à cette recherche.', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('says that a category has no work yet', async () => {
    rendre()
    await userEvent.click(await screen.findByRole('button', { name: 'Jeu vidéo' }))

    expect(await screen.findByText('Aucune œuvre de ce type dans le catalogue.')).toBeInTheDocument()
  })

  it('says nothing while the catalog is still loading', async () => {
    // "Nothing" and "not yet" are two answers: announcing an empty catalog
    // before it has answered would be false half a second later.
    api.searchEntities.mockReturnValue(new Promise(() => {}))
    rendre()
    await screen.findByRole('button', { name: 'Manga' })

    expect(screen.queryByText(/Aucune œuvre/)).not.toBeInTheDocument()
    expect(screen.queryByText('Le catalogue est encore vide.')).not.toBeInTheDocument()
  })
})

/**
 * The catalogue as covers (lot 198). Three rules that no eye would catch:
 * a count that names what it counts, a state that a screen reader still
 * hears once no word is left on the tile, and a heart only where wanting
 * makes sense.
 */
describe('the catalogue as covers', () => {
  const berserk = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })
  const monster = oeuvre({ titre: 'Monster', tomes: [tome(1)] })
  const hades = oeuvre({ titre: 'Hades', typeId: JEU_VIDEO.id })
  const celeste = oeuvre({ titre: 'Celeste', typeId: JEU_VIDEO.id })

  beforeEach(() => {
    api.searchEntities.mockResolvedValue([berserk, monster, hades, celeste])
    api.listAllOwnerships.mockResolvedValue([
      possession({ entityId: monster.id, variantId: 'tome-1' }),
      possession({ entityId: hades.id }),
    ])
    wishlist.entries = [{ id: 'envie-celeste', entityId: celeste.id, variantId: null, addedAt: '2026-10-01' }]
  })

  it('lays one shelf per universe, and counts what it shows', async () => {
    auth.estInvite = false
    rendre()

    expect(await screen.findByRole('heading', { name: 'Manga' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jeu vidéo' })).toBeInTheDocument()
    expect(screen.getByText('4 œuvres · 2 possédées · 1 dans tes envies')).toBeInTheDocument()
  })

  it('still tells a screen reader which work is not owned yet', async () => {
    auth.estInvite = false
    rendre()

    expect(await screen.findByRole('button', { name: /Berserk/ })).toHaveTextContent('Pas encore possédé')
    expect(screen.getByRole('button', { name: /Celeste/ })).toHaveTextContent('Dans tes envies')
    expect(screen.getByRole('button', { name: /Monster/ })).not.toHaveTextContent(/possédé|envies/)
    expect(screen.getByRole('button', { name: /Hades/ })).not.toHaveTextContent(/possédé|envies/)
  })

  it('puts the heart on a game not owned, never on a series nor on what is owned', async () => {
    auth.estInvite = false
    rendre()
    await screen.findByRole('button', { name: /Berserk/ })

    // Celeste only: Berserk is collected by volume (the wanted thing is a
    // volume), Hades and Monster are owned.
    expect(screen.getAllByRole('button', { name: /mes envies/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Retirer de mes envies' })).toBeInTheDocument()
  })

  it('shows a visitor the works, with no state and no heart', async () => {
    auth.estInvite = true
    rendre()

    expect(await screen.findByRole('button', { name: /Berserk/ })).toBeInTheDocument()
    expect(screen.getByText('4 œuvres')).toBeInTheDocument()
    expect(screen.queryByText('Pas encore possédé')).not.toBeInTheDocument()
    expect(screen.queryByText('Dans tes envies')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mes envies/ })).not.toBeInTheDocument()
  })
})
