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
import { typeDeCollection } from '@/test/fixtures'

const metadata = vi.hoisted(() => ({
  searchMetadata: vi.fn(),
  fetchFrenchTitle: vi.fn(),
  seriesSansTomesConnues: vi.fn(),
}))
vi.mock('@/common/api/metadata', () => metadata)

const api = vi.hoisted(() => ({ searchEntities: vi.fn(), listAllOwnerships: vi.fn(), listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entities', () => ({ searchEntities: api.searchEntities }))
vi.mock('@/common/api/ownerships', () => ({ listAllOwnerships: api.listAllOwnerships }))
vi.mock('@/common/api/entityTypes', () => ({ listEntityTypes: api.listEntityTypes }))

const wishlist = vi.hoisted(() => ({
  useWishlist: () => ({ entries: [], variantsVoulus: new Set(), isLoading: false, entryFor: () => undefined }),
}))
vi.mock('@/common/hooks/useWishlist', () => wishlist)

const tags = vi.hoisted(() => ({ listTags: vi.fn() }))
vi.mock('@/common/api/tags', () => tags)

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
  tags.listTags.mockResolvedValue([])
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
    // La quatrième façon d'ajouter (lot 147) : lire une photo de l'étagère.
    expect(screen.getByRole('link', { name: 'Importer depuis une photo' })).toHaveAttribute('href', '/import-photo')
  })
})

describe('l’arrivée', () => {
  it('ouvre sur « Tout », et cherche alors chez toutes les sources', async () => {
    // Le premier type de l'instance était présélectionné pour un compte : le
    // Catalogue ne montrait alors qu'un univers pris pour les autres
    // (lot 139). Et sous « Tout », la recherche externe était coupée :
    // « Injustice » ne répondait qu'après avoir choisi « Jeu vidéo »
    // (lot 145). Taper un titre interroge désormais chaque catégorie qui a
    // une source, sans en choisir une d'avance.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manga' })).toBeInTheDocument())
    await userEvent.type(screen.getByRole('textbox'), 'berserk')

    await waitFor(() => expect(metadata.searchMetadata).toHaveBeenCalledWith(MANGA.id, 'berserk', expect.anything()), {
      timeout: 3000,
    })
    expect(screen.queryByText(/Seul le catalogue est parcouru/)).not.toBeInTheDocument()
  })

  it('présente les résultats par catégorie quand plusieurs sont cherchées', async () => {
    const jeuVideo = { ...typeDeCollection('VIDEO_GAME', 'Jeu vidéo'), hasMetadataProvider: true }
    api.listEntityTypes.mockResolvedValue([MANGA, jeuVideo])
    render(<SearchPage />, { wrapper: enrobage })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Jeu vidéo' })).not.toHaveLength(0))

    // Le dernier champ : celui de CE rendu, pas de celui posé par beforeEach.
    const champs = screen.getAllByRole('textbox')
    await userEvent.type(champs[champs.length - 1], 'berserk')

    // Une requête par catégorie, et un groupe nommé pour chacune : le
    // résultat dit d'où il vient, parce que l'écran ne l'a pas demandé.
    await waitFor(() => expect(metadata.searchMetadata).toHaveBeenCalledWith(jeuVideo.id, 'berserk', expect.anything()), {
      timeout: 3000,
    })
    expect(await screen.findByRole('region', { name: 'Jeu vidéo' }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Manga' })).toBeInTheDocument()
  })
})

describe('les tags', () => {
  it('ne propose aucune rangée de tags quand il n’en existe pas', async () => {
    // Le filtre qui ne filtre jamais rien - déjà refusé sur Ma collection.
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.queryByRole('group', { name: 'Filtrer par tag' })).not.toBeInTheDocument()
  })

  it('filtre le catalogue par un tag, et le second clic le retire', async () => {
    // Un tag décrit une œuvre et vit dans le catalogue : c'est ici qu'il
    // filtre le plus naturellement (lot 143). Un seul à la fois, comme le
    // paramètre du serveur.
    tags.listTags.mockResolvedValue([{ id: 't-seinen', label: 'seinen' }])
    render(<SearchPage />, { wrapper: enrobage })
    const seinen = await screen.findByRole('button', { name: 'seinen' })

    await userEvent.click(seinen)
    await waitFor(() => expect(api.searchEntities).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: 't-seinen' })))

    await userEvent.click(seinen)
    await waitFor(() => expect(api.searchEntities).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: undefined })))
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
    // Le réglage vit dans « Cet appareil », sur Profil (lot 140).
    expect(lien).toHaveAttribute('href', '/profile')
  })

  it('n’apparaît pas avant qu’il y ait des titres à gouverner', async () => {
    // Un réglage proposé devant une liste vide serait du bruit permanent sur
    // le seul écran d'ajout.
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.queryByRole('link', { name: /Langue des titres/ })).not.toBeInTheDocument()
  })
})
