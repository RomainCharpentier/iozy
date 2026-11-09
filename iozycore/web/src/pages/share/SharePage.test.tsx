/**
 * The "Partager" page (lot 217): what takes a link back asks twice, the
 * preview is the public page, the incontournables are chosen among what is
 * owned, and the gift list says when it stops.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SharePage } from './SharePage'
import {
  getGiftPreview,
  getShare,
  getSharePreview,
  getShareValue,
  issueGiftLink,
  removeShare,
  setPinnedWorks,
} from '@/common/api/share'
import { fetchCollectionSummary, listWorks } from '@/common/api/works'
import { getYearlyRecap } from '@/common/api/insights'
import type { ShareDto, SharedSpaceDto } from '@/common/types/share'
import type { WorkProgressDto } from '@/common/types/api'

vi.mock('@/common/api/share', () => ({
  generateShare: vi.fn(),
  getShare: vi.fn(),
  getSharePreview: vi.fn(),
  getGiftPreview: vi.fn(),
  getShareValue: vi.fn(),
  issueGiftLink: vi.fn(),
  removeGiftLink: vi.fn(),
  removeShare: vi.fn(),
  setPinnedWorks: vi.fn(),
  updateShare: vi.fn(),
}))
vi.mock('@/common/api/works', () => ({ listWorks: vi.fn(), fetchCollectionSummary: vi.fn() }))
vi.mock('@/common/api/insights', () => ({ getYearlyRecap: vi.fn() }))

const actif: ShareDto = {
  token: 'abc',
  shareCollection: true,
  shareWishlist: true,
  includeTierLists: false,
  showValue: false,
  pinnedWorkIds: [],
  giftLink: null,
}

const apercu: SharedSpaceDto = {
  collection: [{ label: 'Manga', items: [{ title: 'Akira', coverImageUrl: null, editions: [], ownedVolumeCount: 6, totalVolumes: 6 }] }],
  wishlist: [],
  tierLists: null,
  pinned: [],
  value: null,
  giftList: false,
  expiresAt: null,
}

function oeuvre(id: string, titre: string, possedes: number): WorkProgressDto {
  return {
    entityId: id,
    entityTypeId: 't',
    title: titre,
    coverImageUrl: null,
    collectorStatus: 'ONGOING',
    ownedCount: possedes,
    totalCount: null,
    missingCount: 0,
    wishedCount: 0,
    nextReleaseDate: null,
    lastMovedAt: null,
  }
}

function ouvrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SharePage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getShare).mockResolvedValue(actif)
  vi.mocked(getSharePreview).mockResolvedValue(apercu)
  vi.mocked(getGiftPreview).mockResolvedValue({ ...apercu, collection: null, pinned: null, giftList: true })
  vi.mocked(getShareValue).mockResolvedValue(null)
  vi.mocked(listWorks).mockResolvedValue([oeuvre('a', 'Akira', 6), oeuvre('m', 'Monster', 0)])
  vi.mocked(fetchCollectionSummary).mockResolvedValue({ totalObjects: 6, addedThisMonth: 0, addedThisMonthByType: [], byType: [] })
  vi.mocked(getYearlyRecap).mockResolvedValue({
    year: 2026,
    acquisitionsCount: 2,
    acquisitionsByType: [],
    seriesStartedCount: 1,
    experiencesCount: 0,
    averageRating: null,
    mostFeaturedCreator: null,
    mostFeaturedCreatorCount: 0,
    availableYears: [2026],
  })
})

describe('SharePage', () => {
  it('shows the public page as visitors see it', async () => {
    ouvrir()

    const apercuVisiteurs = (await screen.findByRole('heading', { name: 'Ce que voient tes visiteurs' })).closest('section')!
    expect(await within(apercuVisiteurs).findByRole('heading', { name: 'Collection et envies partagées' })).toBeInTheDocument()
    expect(within(apercuVisiteurs).getAllByText('Akira').length).toBeGreaterThan(0)
  })

  it('deactivates the link only after a second, explicit click', async () => {
    vi.mocked(removeShare).mockResolvedValue(undefined)
    ouvrir()

    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver le partage' }))
    expect(removeShare).not.toHaveBeenCalled()
    expect(screen.getByText('Ta page ne sera plus visible par personne.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Oui, désactiver' }))
    expect(await screen.findByRole('button', { name: 'Activer ma page' })).toBeInTheDocument()
    expect(removeShare).toHaveBeenCalledTimes(1)
  })

  it('offers only owned works as incontournables, and saves the choice', async () => {
    vi.mocked(setPinnedWorks).mockResolvedValue({ ...actif, pinnedWorkIds: ['a'] })
    ouvrir()

    fireEvent.click(await screen.findByRole('button', { name: 'Épingler Akira' }))
    expect(screen.queryByRole('button', { name: 'Épingler Monster' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Retirer Akira de mes incontournables' })).toBeInTheDocument()
    expect(vi.mocked(setPinnedWorks).mock.calls[0][0]).toEqual(['a'])
  })

  it('creates a gift list that says when it stops', async () => {
    vi.mocked(issueGiftLink).mockResolvedValue({
      ...actif,
      giftLink: { token: 'cadeau', expiresAt: '2026-12-09T10:00:00Z', expired: false },
    })
    ouvrir()

    fireEvent.click(await screen.findByRole('button', { name: 'Créer ma liste de cadeaux' }))

    expect(await screen.findByText('Expire le 9 décembre 2026')).toBeInTheDocument()
    expect(screen.getByText(/public\/share\/cadeau/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Liste de cadeaux' })).toBeInTheDocument()
  })

  it('says why the image carries no value', async () => {
    ouvrir()

    expect(
      await screen.findByText('Sans valeur estimée : il faut au moins 5 objets avec un prix, et la moitié de ta collection.'),
    ).toBeInTheDocument()
  })
})
