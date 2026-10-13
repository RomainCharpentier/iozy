/**
 * <b>A scanned volume joins its series.</b>
 *
 * <p>An ISBN names one volume: "One Piece - Édition originale Tome 01". This
 * text used to be the title of the work, so each scanned volume created its
 * own series, with the collection label ("Shônen Manga") as edition. The
 * backend now gives the series as the title and the volume apart; the scan
 * must add THAT volume to THAT series.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScanPage } from './ScanPage'
import { typeDeCollection } from '@/test/fixtures'

const metadata = vi.hoisted(() => ({ lookupBarcode: vi.fn() }))
vi.mock('@/common/api/metadata', () => metadata)

const api = vi.hoisted(() => ({ quickAdd: vi.fn(), searchEntities: vi.fn(), listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entities', () => ({ quickAdd: api.quickAdd, searchEntities: api.searchEntities }))
vi.mock('@/common/api/entityTypes', () => ({ listEntityTypes: api.listEntityTypes }))
vi.mock('@/common/hooks/useWishlist', () => ({
  useWishlist: () => ({ entries: [], variantsVoulus: new Set(), isLoading: false, entryFor: () => undefined }),
}))

const MANGA = { ...typeDeCollection('MANGA', 'Manga'), hasMetadataProvider: true }

function rendre() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/scan']}>
        <ScanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listEntityTypes.mockResolvedValue([MANGA])
  api.searchEntities.mockResolvedValue([])
  api.quickAdd.mockResolvedValue({ matchedExistingVariant: false })
  metadata.lookupBarcode.mockResolvedValue({
    source: 'OPEN_LIBRARY',
    externalId: '9782723488525',
    title: 'One Piece',
    imageUrl: null,
    attributes: { publisher: 'GLENAT' },
    volume: { sourceTitle: 'One Piece - Édition originale Tome 01', number: 1, edition: 'Édition originale' },
  })
})

describe('a scanned volume', () => {
  it('is added as its volume of its series, in the edition its title names', async () => {
    rendre()
    await userEvent.type(await screen.findByLabelText('Ou saisis le code-barres (ISBN)'), '9782723488525')
    await userEvent.click(screen.getByRole('button', { name: 'Chercher' }))

    expect(await screen.findByText('Tome 1 · Édition originale')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter à ma collection' }))

    expect(api.quickAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'One Piece', volumeNumber: 1, edition: 'Édition originale' }),
    )
  })
})
