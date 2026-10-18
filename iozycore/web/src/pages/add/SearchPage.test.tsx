/**
 * <b>The three ways to add, and the setting that decides the titles.</b>
 *
 * <p>This screen is the only entry point to add to one's collection. Two
 * things get lost in it silently:
 * <ul>
 *   <li>the <b>add entries</b> — typing a title, scanning, importing from
 *       BGG. The import lived under Administration until 2026-08-29, where
 *       nobody went to look for it;</li>
 *   <li>the <b>order of the title languages</b>, which decides what this list
 *       shows and what will be saved. It lived in Settings with
 *       no link from here: we saw a title in romaji without knowing that
 *       it was a choice, still less where to change it.</li>
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
      // `attributes` carries the titles per language: it is THIS that the setting
      // governs, and omitting it made the rendering crash (found while writing
      // this test - the mocked candidate was not a candidate).
      attributes: { titleRomaji: 'Berserk', titleEnglish: 'Berserk' },
    },
  ])
  render(<SearchPage />, { wrapper: enrobage })
})

describe('the ways to add', () => {
  it('brings together search, scan and import', async () => {
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.getByRole('link', { name: 'Scanner' })).toHaveAttribute('href', '/scan')
    // Under Administration until 2026-08-29: getting one's games from
    // BoardGameGeek is adding to one's collection, not administering.
    expect(screen.getByRole('link', { name: 'Importer depuis BGG' })).toHaveAttribute('href', '/import-bgg')
    // The fourth way to add (batch 147): reading a photo of the shelf.
    expect(screen.getByRole('link', { name: 'Importer depuis une photo' })).toHaveAttribute('href', '/import-photo')
  })
})

describe('the arrival', () => {
  it('opens on "Tout", and then searches all the sources', async () => {
    // The first type of the instance was preselected for an account: the
    // Catalogue then only showed one universe taken for the others
    // (batch 139). And under "Tout", the external search was cut off:
    // "Injustice" only answered after choosing "Jeu vidéo"
    // (batch 145). Typing a title now queries every category that has
    // a source, without choosing one in advance.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manga' })).toBeInTheDocument())
    await userEvent.type(screen.getByRole('textbox'), 'berserk')

    await waitFor(() => expect(metadata.searchMetadata).toHaveBeenCalledWith(MANGA.id, 'berserk', expect.anything()), {
      timeout: 3000,
    })
    expect(screen.queryByText(/Seul le catalogue est parcouru/)).not.toBeInTheDocument()
  })

  it('presents the results by category when several are searched', async () => {
    const jeuVideo = { ...typeDeCollection('VIDEO_GAME', 'Jeu vidéo'), hasMetadataProvider: true }
    api.listEntityTypes.mockResolvedValue([MANGA, jeuVideo])
    render(<SearchPage />, { wrapper: enrobage })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Jeu vidéo' })).not.toHaveLength(0))

    // The last field: the one of THIS render, not the one set by beforeEach.
    const champs = screen.getAllByRole('textbox')
    await userEvent.type(champs[champs.length - 1], 'berserk')

    // One query per category, and a named group for each: the
    // result says where it comes from, because the screen did not ask for it.
    await waitFor(() => expect(metadata.searchMetadata).toHaveBeenCalledWith(jeuVideo.id, 'berserk', expect.anything()), {
      timeout: 3000,
    })
    expect(await screen.findByRole('region', { name: 'Jeu vidéo' }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Manga' })).toBeInTheDocument()
  })
})

describe('the tags', () => {
  it('offers no row of tags when none exist', async () => {
    // The filter that never filters anything - already refused on My collection.
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.queryByRole('group', { name: 'Filtrer par tag' })).not.toBeInTheDocument()
  })

  it('filters the catalogue by a tag, and the second click removes it', async () => {
    // A tag describes a work and lives in the catalogue: it is here that it
    // filters most naturally (batch 143). Only one at a time, like the
    // server parameter.
    tags.listTags.mockResolvedValue([{ id: 't-seinen', label: 'seinen' }])
    render(<SearchPage />, { wrapper: enrobage })
    const seinen = await screen.findByRole('button', { name: 'seinen' })

    await userEvent.click(seinen)
    await waitFor(() => expect(api.searchEntities).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: 't-seinen' })))

    await userEvent.click(seinen)
    await waitFor(() => expect(api.searchEntities).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: undefined })))
  })
})

describe('the title language', () => {
  /** Searches until suggestions are obtained - that is where the setting acts. */
  async function chercher() {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manga' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Manga' }))
    await userEvent.type(screen.getByRole('textbox'), 'berserk')
    await waitFor(() => expect(screen.getByText('Suggestions')).toBeInTheDocument(), { timeout: 3000 })
  }

  it('is set from the list it governs', async () => {
    await chercher()

    const lien = screen.getByRole('link', { name: /Langue des titres/ })
    // The setting lives in "Cet appareil", on Profil (batch 140).
    expect(lien).toHaveAttribute('href', '/profile')
  })

  it('does not appear before there are titles to govern', async () => {
    // A setting offered in front of an empty list would be permanent noise on
    // the only add screen.
    await waitFor(() => expect(api.listEntityTypes).toHaveBeenCalled())

    expect(screen.queryByRole('link', { name: /Langue des titres/ })).not.toBeInTheDocument()
  })
})
