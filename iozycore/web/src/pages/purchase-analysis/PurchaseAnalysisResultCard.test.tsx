/**
 * <b>One screen, one answer.</b>
 *
 * The exploratory test of 2026-10-13: the user owns Pluto 1-6 of 8, a listing sells 7-8 for
 * 12 EUR plus 4 EUR of shipping typed by hand, and nobody has recorded a price. The same
 * screen said "prix impossible à situer", "Cher", and "6/8 volumes manquants" for a lot
 * that completes the edition. These tests keep the three readings from coming back.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PurchaseAnalysisResultCard } from './PurchaseAnalysisResultCard'
import type { ItemAnalysisDto, PurchaseAnalysisDto } from '@/common/types/purchaseAnalysis'

vi.mock('@/common/api/wishlist', () => ({
  listWishlist: vi.fn().mockResolvedValue([]),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}))

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const edition = {
  id: 'ed-1',
  entityId: 'pluto',
  seriesTitle: 'Pluto',
  editionName: 'Standard',
  tier: 'STANDARD' as const,
  publisher: 'Kana',
  totalVolumes: 8,
  retailPriceNewPerVolume: 9,
  outOfPrint: false,
  betterEditionAnnounced: false,
  betterEditionNote: null,
  languageCode: 'fr',
  createdAt: '2026-10-13T10:00:00Z',
  updatedAt: '2026-10-13T10:00:00Z',
}

function serie(missingCount: number, missingVolumeNumbers: number[]): ItemAnalysisDto {
  return {
    item: {
      series: { title: 'Pluto', knownEntityId: 'pluto' },
      editionNameRaw: 'Standard',
      includedVolumes: [7, 8],
      itemConditionOverride: null,
    },
    matchedEdition: edition,
    completeness: {
      edition,
      totalVolumes: 8,
      missingCount,
      missingVolumeNumbers,
      cataloguedMissingVolumeNumbers: [],
      estimatedCostToComplete: missingCount * 9,
      costToCompleteBasis: missingCount > 0 ? 'THEORETICAL_ONLY' : null,
    },
    marketPrice: {
      observationCount: 0,
      observedMedian: null,
      observedLow: null,
      observedHigh: null,
      theoreticalEstimate: 9,
      basis: 'THEORETICAL_ONLY',
      confidence: 'LOW',
      aiEstimatedPrice: null,
    },
    editionWarnings: [],
    itemCostShare: 16,
    duplicates: { duplicateVolumeNumbers: [], usefulVolumeCount: 2, pricePerUsefulVolume: 8, maxWorthwhilePrice: 18 },
  }
}

function analyse(patch: Partial<PurchaseAnalysisDto> = {}): PurchaseAnalysisDto {
  return {
    id: 'a-1',
    requestedAt: '2026-10-13T10:00:00Z',
    listing: {
      id: 'l-1',
      platform: 'OTHER',
      url: null,
      rawTitle: 'Pluto 7-8',
      shippingKind: 'ESTIMATED',
      askingPrice: 12,
      shippingFee: 4,
      buyerProtectionFee: 0,
      condition: 'VERY_GOOD',
      conditionAppliesToContainer: false,
      items: [],
      photoUrls: [],
      requestedAt: '2026-10-13T10:00:00Z',
    },
    // What the server now sends: the owned volumes 1-6 count, nothing is missing.
    itemBreakdown: [serie(0, [])],
    totalRealCost: 16,
    totalNewValue: 18,
    totalSavingsAmount: 2,
    discountPercent: 11,
    negotiation: {
      recommendedOffer: 11.4,
      targetPriceMin: 11.4,
      targetPriceMax: 12.6,
      maxPrice: 12.6,
      advice: 'ACCEPTABLE_AS_IS',
      rationale: 'Montants calculés sur une valeur estimée, faute de prix relevé sur un lot comparable : un repère pour négocier, pas un avis sur le prix demandé.',
      priceDataAvailable: true,
    },
    verdict: 'EXPENSIVE',
    verdictScore: 39,
    factorBreakdown: {},
    warnings: [],
    overallConfidence: 'MEDIUM',
    totalMaxWorthwhilePrice: 18,
    assessment: {
      collectionFit: {
        detectedItemCount: 2,
        ownedItemCount: 0,
        missingItemCount: 2,
        wishlistedItemCount: 0,
        usefulItemCount: 2,
        pricePerItem: 8,
        pricePerUsefulItem: 8,
        interest: 'HIGHLY_USEFUL',
      },
      pricePosition: 'REFERENCE_UNAVAILABLE',
      referencePrice: null,
      referenceConfidence: 'UNAVAILABLE',
      deviationPercent: null,
      referenceSampleSize: 0,
      referenceSource: 'NONE',
      referenceGap: 'NO_OBSERVATION',
      referenceSpreadPercent: null,
      referenceMostRecentObservation: null,
      referenceExaminedCount: 0,
      trust: { level: 'A_FEW_THINGS_TO_CHECK', signals: ['NO_PHOTO'] },
      headline: 'USEFUL_PRICE_UNKNOWN',
    },
    ...patch,
  }
}

describe('the purchase analysis result', () => {
  it('gives one price verdict: no price word next to "Référence insuffisante"', () => {
    render(<PurchaseAnalysisResultCard analysis={analyse()} onReset={() => {}} />, { wrapper: enrobage })

    expect(screen.getByText('Référence insuffisante')).toBeInTheDocument()
    expect(screen.queryByText('Cher')).not.toBeInTheDocument()
    expect(screen.queryByText(/Prix correct/)).not.toBeInTheDocument()
    // The score stays readable, as a note.
    expect(screen.getByText(/Note globale/).textContent).toContain('39/100')
  })

  it('keeps the badge of an old analysis that had no other verdict', () => {
    const ancienne = analyse({ assessment: undefined as unknown as PurchaseAnalysisDto['assessment'] })
    render(<PurchaseAnalysisResultCard analysis={ancienne} onReset={() => {}} />, { wrapper: enrobage })

    expect(screen.getByText('Cher')).toBeInTheDocument()
  })

  it('says the lot completes the edition when the owned volumes fill the rest', () => {
    render(<PurchaseAnalysisResultCard analysis={analyse()} onReset={() => {}} />, { wrapper: enrobage })

    expect(screen.getByText(/Édition complète avec ce lot/).textContent).toContain('2 dans le lot + 6 déjà possédés')
    // The fit block above rightly says "2 manquants" (missing from the collection); the
    // series line must not add "6 manquants" to complete the edition.
    expect(screen.queryByText(/\/8 volumes/)).not.toBeInTheDocument()
  })

  it('counts the owned volumes in the missing line too', () => {
    // The user owns 1-3: 4, 5 and 6 are still missing after this lot.
    render(
      <PurchaseAnalysisResultCard analysis={analyse({ itemBreakdown: [serie(3, [4, 5, 6])] })} onReset={() => {}} />,
      { wrapper: enrobage },
    )

    expect(screen.getByText(/volumes avec ce lot et ta collection/).textContent).toContain('5/8')
  })

  it('shows a shipping amount typed by the user as typed, not as estimated', () => {
    render(<PurchaseAnalysisResultCard analysis={analyse()} onReset={() => {}} />, { wrapper: enrobage })

    expect(screen.queryByText(/estimés/)).not.toBeInTheDocument()
    expect(screen.getByText(/montant saisi/).textContent).toMatch(/4,00\s€/)
  })
})
