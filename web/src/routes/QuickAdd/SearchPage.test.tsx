/**
 * <b>Les trois façons d'ajouter, et le réglage qui décide des titres.</b>
 *
 * <p>Cet écran est le seul point d'entrée pour ajouter à sa collection. Deux
 * choses s'y perdent en silence :
 * <ul>
 *   <li>les <b>entrées d'ajout</b> — taper un titre, scanner, importer depuis
 *       BGG. L'import a vécu sous Administration jusqu'au 2026-08-29, où
 *       personne n'allait le chercher ;</li>
 *   <li>l'<b>ordre des langues de titre</b>, qui décide de ce que cette liste
 *       affiche et de ce qui sera enregistré. Il vivait dans Paramètres sans
 *       aucun lien depuis ici : on voyait un titre en romaji sans savoir que
 *       c'était un choix, encore moins où le changer.</li>
 * </ul>
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SearchPage } from './SearchPage'
import { typeDeCollection } from '../../test/fixtures'

const metadata = vi.hoisted(() => ({
  searchMetadata: vi.fn(),
  fetchFrenchTitle: vi.fn(),
  seriesSansTomesConnues: vi.fn(),
}))
vi.mock('../../api/metadata', () => metadata)

const api = vi.hoisted(() => ({ searchEntities: vi.fn(), listAllOwnerships: vi.fn(), listEntityTypes: vi.fn() }))
vi.mock('../../api/entities', () => ({ searchEntities: api.searchEntities }))
vi.mock('../../api/ownerships', () => ({ listAllOwnerships: api.listAllOwnerships }))
vi.mock('../../api/entityTypes', () => ({ listEntityTypes: api.listEntityTypes }))

const wishlist = vi.hoisted(() => ({
  useWishlist: () => ({ entries: [], variantsVoulus: new Set(), isLoading: false, entryFor: () => undefined }),
}))
vi.mock('../../lib/useWishlist', () => wishlist)

const MANGA = { ...typeDeCollection('MANGA', 'Manga'), hasMetadataProvider: true }

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
  api.listEntityTypes.mockResolvedValue([MANGA])
  api.searchEntities.mockResolvedValue([])
  api.listAllOwnerships.mockResolvedValue([])
  metadata.fetchFrenchTitle.mockResolvedValue(null)
  metadata.seriesSansTomesConnues.mockResolvedValue([])
  metadata.searchMetadata.mockResolvedValue([
    {
      externalId: 'mal-1',
      source: 'MYANIMELIST',
      title: 'Berserk',
      imageUrl: null,
      mediaType: 'Manga',
      startYear: 1989,
      // `attributes` porte les titres par langue : c'est LUI que le réglage
      // gouverne, et l'omettre faisait planter le rendu (constaté en écrivant
      // ce test - le candidat mocké n'était pas un candidat).
      attributes: { titleRomaji: 'Berserk', titleEnglish: 'Berserk' },
    },
  ])
  render(<SearchPage />, { wrapper: enrobage })
})

describe('les façons d’ajouter', () => {
  it('réunit la recherche, le scan et l’import', async () => {
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.getByRole('link', { name: 'Scanner' })).toHaveAttribute('href', '/scan')
    // Sous Administration jusqu'au 2026-08-29 : récupérer ses jeux depuis
    // BoardGameGeek, c'est ajouter à sa collection, pas administrer.
    expect(screen.getByRole('link', { name: 'Importer depuis BGG' })).toHaveAttribute('href', '/import-bgg')
  })
})

describe('la langue des titres', () => {
  /** Cherche jusqu'à obtenir des suggestions - c'est là que le réglage agit. */
  async function chercher() {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manga' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Manga' }))
    await userEvent.type(screen.getByRole('textbox'), 'berserk')
    await waitFor(() => expect(screen.getByText('Suggestions')).toBeInTheDocument(), { timeout: 3000 })
  }

  it('se règle depuis la liste qu’elle gouverne', async () => {
    await chercher()

    const lien = screen.getByRole('link', { name: /Langue des titres/ })
    expect(lien).toHaveAttribute('href', '/settings')
  })

  it('n’apparaît pas avant qu’il y ait des titres à gouverner', async () => {
    // Un réglage proposé devant une liste vide serait du bruit permanent sur
    // le seul écran d'ajout.
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.queryByRole('link', { name: /Langue des titres/ })).not.toBeInTheDocument()
  })
})
