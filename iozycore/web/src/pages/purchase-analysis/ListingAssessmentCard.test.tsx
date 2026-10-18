/**
 * <b>What the verdict card promises on screen.</b>
 *
 * This card is the only place in the app where a market figure is displayed
 * with what allows one to doubt it. Three promises break silently here, and
 * none is protected by a type:
 * <ul>
 *   <li>a reference price is <b>never</b> shown alone - it comes with its
 *       sample, its dispersion, its freshness and its origin;</li>
 *   <li>an absence of reference says <b>which one</b>: "no data" and
 *       "records, but no comparable" do not call for the same action;</li>
 *   <li>an old analysis is not given after the fact an assurance
 *       that it did not have.</li>
 * </ul>
 *
 * <p>The texts are checked by what the user reads, never by a CSS
 * class or a `data-testid`: the sentence is the feature.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListingAssessmentCard } from './ListingAssessmentCard'
import type { ListingAssessmentDto } from '@/common/types/purchaseAnalysis'

/** A complete and calm analysis; each test only restates what it changes. */
function evaluation(patch: Partial<ListingAssessmentDto> = {}): ListingAssessmentDto {
  return {
    collectionFit: {
      detectedItemCount: 10,
      ownedItemCount: 2,
      missingItemCount: 8,
      wishlistedItemCount: 0,
      usefulItemCount: 8,
      pricePerItem: 5,
      pricePerUsefulItem: 6.25,
      interest: 'HIGHLY_USEFUL',
    },
    pricePosition: 'FAIR_PRICE',
    referencePrice: 50,
    referenceConfidence: 'HIGH',
    deviationPercent: -12,
    referenceSampleSize: 3,
    referenceSource: 'OBSERVED_COMPARABLES',
    referenceGap: 'NONE',
    referenceSpreadPercent: 12,
    referenceMostRecentObservation: '2026-08-20',
    referenceExaminedCount: 3,
    trust: { level: 'NO_OBVIOUS_SIGNAL', signals: [] },
    headline: 'GOOD_FOR_YOUR_COLLECTION',
    ...patch,
  }
}

/** The paragraph that carries the reference, whatever its internal split. */
function ligneDeReference(): string {
  return screen.getByText(/Référence/).textContent ?? ''
}

describe('the market reference', () => {
  it('comes out with its four reservations, never the price alone', () => {
    render(<ListingAssessmentCard assessment={evaluation()} />)

    const ligne = ligneDeReference()
    // Decimal comma and narrow no-break space before the symbol: the French writing (batch 148).
    expect(ligne).toMatch(/50,00\s€/)
    expect(ligne).toContain('confiance bonne')
    expect(ligne).toContain('3 annonces comparables')
    expect(ligne).toContain('resserrés à 12 % près')
    expect(ligne).toContain('le plus récent le 20/08/2026')
  })

  it('always says where the figure comes from: records, not completed sales', () => {
    render(<ListingAssessmentCard assessment={evaluation()} />)

    expect(ligneDeReference()).toContain('pas des ventes conclues')
  })

  it('keeps quiet about the reservations of an analysis that did not carry them, without inventing anything', () => {
    // An analysis from before Batch 88: the price and the sample stay, the
    // dispersion and the freshness are not displayed rather than being 0.
    render(
      <ListingAssessmentCard
        assessment={evaluation({ referenceSpreadPercent: null, referenceMostRecentObservation: null })}
      />,
    )

    const ligne = ligneDeReference()
    expect(ligne).toContain('3 annonces comparables')
    expect(ligne).not.toContain('resserrés')
    expect(ligne).not.toContain('le plus récent')
  })
})

describe('the absence of reference', () => {
  const sansReference = {
    pricePosition: 'REFERENCE_UNAVAILABLE',
    referencePrice: null,
    deviationPercent: null,
    referenceConfidence: 'UNAVAILABLE',
    referenceSampleSize: 0,
    referenceSpreadPercent: null,
    referenceMostRecentObservation: null,
    headline: 'USEFUL_PRICE_UNKNOWN',
  } satisfies Partial<ListingAssessmentDto>

  it('tells "records exist" apart from "no data"', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ ...sansReference, referenceGap: 'NO_COMPARABLE_SHAPE', referenceExaminedCount: 3 })}
      />,
    )

    expect(screen.getByText(/aucun sur un lot comparable/)).toHaveTextContent(
      '3 prix relevés examinés pour cette édition',
    )
  })

  it('does not talk about examined records when there are none', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ ...sansReference, referenceGap: 'NO_OBSERVATION', referenceExaminedCount: 0 })}
      />,
    )

    expect(screen.getByText(/Aucun prix relevé sur cette édition/)).toBeInTheDocument()
    expect(screen.queryByText(/examiné/)).not.toBeInTheDocument()
  })

  it('shows no reference price when it is unusable', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ ...sansReference, referenceGap: 'NO_OBSERVATION', referenceExaminedCount: 0 })}
      />,
    )

    expect(screen.getByText('Référence insuffisante')).toBeInTheDocument()
    expect(screen.queryByText(/50,00\s€/)).not.toBeInTheDocument()
  })

  it('a provenance that was not kept does not read as a market price', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ referenceSource: 'NOT_RECORDED', referenceSpreadPercent: null })}
      />,
    )

    expect(screen.getByText(/Estimation utilisée lors de cette analyse/)).toBeInTheDocument()
    expect(screen.queryByText(/confiance bonne/)).not.toBeInTheDocument()
  })
})

describe('the cost per item', () => {
  it('warns that costs are underestimated when the delivery is unknown', () => {
    render(<ListingAssessmentCard assessment={evaluation()} shippingKind="UNKNOWN" />)

    expect(screen.getByText('Livraison non incluse : ces coûts sont sous-évalués.')).toBeInTheDocument()
  })

  it('says "at least" when the shipping is only a "from"', () => {
    render(<ListingAssessmentCard assessment={evaluation()} shippingKind="FROM" />)

    expect(screen.getByText(/au moins/)).toHaveTextContent('5,00 € / élément')
  })

  it('does not repeat the useful cost when no duplicate sets it apart', () => {
    const sansDoublon = evaluation()
    sansDoublon.collectionFit = { ...sansDoublon.collectionFit, pricePerUsefulItem: 5 }

    render(<ListingAssessmentCard assessment={sansDoublon} />)

    expect(screen.queryByText(/réellement utile/)).not.toBeInTheDocument()
  })
})
