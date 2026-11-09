/**
 * The public page: what a visitor reads, from a link that works, a dead one
 * and a gift list past its thirty days.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SharedSpacePage } from './SharedSpacePage'
import { getSharedSpace } from '@/common/api/share'
import { ApiError } from '@/common/api/client'
import type { SharedSpaceDto } from '@/common/types/share'

vi.mock('@/common/api/share', () => ({ getSharedSpace: vi.fn() }))

function ouvrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/public/share/abc']}>
        <Routes>
          <Route path="/public/share/:token" element={<SharedSpacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const collection: SharedSpaceDto = {
  collection: [{ label: 'Manga', items: [{ title: 'Akira', coverImageUrl: null, editions: [], ownedVolumeCount: 6, totalVolumes: 6 }] }],
  wishlist: null,
  tierLists: null,
  pinned: [{ title: 'Frieren', coverImageUrl: null, ownedCount: 3, totalCount: 13 }],
  value: null,
  giftList: false,
  expiresAt: null,
}

beforeEach(() => vi.clearAllMocks())

describe('SharedSpacePage', () => {
  it('opens on the pinned works', async () => {
    vi.mocked(getSharedSpace).mockResolvedValue(collection)
    ouvrir()

    expect(await screen.findByRole('heading', { name: 'Collection partagée' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mes incontournables' })).toBeInTheDocument()
    expect(screen.getAllByText('Frieren').length).toBeGreaterThan(0)
    expect(screen.getByText('3/13')).toBeInTheDocument()
  })

  it('shows the value only when the server sent it, with what it rests on', async () => {
    vi.mocked(getSharedSpace).mockResolvedValue({
      ...collection,
      value: { totalKnownValue: 1234.5, pricedCount: 12, totalCount: 20 },
    })
    ouvrir()

    expect(await screen.findByText(/^1\s234,50\s€$/)).toBeInTheDocument()
    expect(screen.getByText('Valeur estimée, d’après le prix neuf de 12 objets sur 20')).toBeInTheDocument()
  })

  it('shows no value at all when none was sent', async () => {
    vi.mocked(getSharedSpace).mockResolvedValue(collection)
    ouvrir()

    await screen.findByRole('heading', { name: 'Collection partagée' })
    expect(screen.queryByText(/Valeur estimée/)).not.toBeInTheDocument()
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
  })

  it('names a gift list and until when it answers', async () => {
    vi.mocked(getSharedSpace).mockResolvedValue({
      collection: null,
      wishlist: [{ title: 'Pluto', coverImageUrl: null, addedAt: '2026-11-01' }],
      tierLists: null,
      pinned: null,
      value: null,
      giftList: true,
      expiresAt: '2026-12-09T10:00:00Z',
    })
    ouvrir()

    expect(await screen.findByRole('heading', { name: 'Liste de cadeaux' })).toBeInTheDocument()
    expect(screen.getByText('Valable jusqu’au 9 décembre 2026')).toBeInTheDocument()
  })

  it('says an expired gift list has expired', async () => {
    vi.mocked(getSharedSpace).mockRejectedValue(new ApiError(410, 'Ce lien a expiré'))
    ouvrir()

    expect(await screen.findByText(/Ce lien a expiré\./)).toBeInTheDocument()
  })

  it('stays neutral on an unknown link', async () => {
    vi.mocked(getSharedSpace).mockRejectedValue(new ApiError(404, 'Introuvable'))
    ouvrir()

    expect(await screen.findByText("Ce lien n'existe pas ou n'est plus actif.")).toBeInTheDocument()
    expect(screen.queryByText(/expiré/)).not.toBeInTheDocument()
  })
})
