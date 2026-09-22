/**
 * <b>Ce que la carte du verdict promet à l'écran.</b>
 *
 * Cette carte est le seul endroit de l'app où un chiffre de marché s'affiche
 * avec ce qui permet d'en douter. Trois promesses s'y cassent en silence, et
 * aucune n'est protégée par un type :
 * <ul>
 *   <li>un prix de référence ne s'affiche <b>jamais</b> seul - il sort avec son
 *       échantillon, sa dispersion, sa fraîcheur et sa provenance ;</li>
 *   <li>une absence de référence dit <b>laquelle</b> : « aucune donnée » et
 *       « des relevés, mais aucun comparable » n'appellent pas le même geste ;</li>
 *   <li>une analyse ancienne ne se voit pas attribuer après coup une assurance
 *       qu'elle n'avait pas.</li>
 * </ul>
 *
 * <p>Les textes sont vérifiés par ce que l'utilisateur lit, jamais par une
 * classe CSS ou un `data-testid` : c'est la phrase qui est la fonctionnalité.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ListingAssessmentCard } from './ListingAssessmentCard'
import type { ListingAssessmentDto } from '@/common/types/purchaseAnalysis'

/** Une analyse complète et sereine ; chaque test ne redit que ce qu'il change. */
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

/** Le paragraphe qui porte la référence, quel que soit son découpage interne. */
function ligneDeReference(): string {
  return screen.getByText(/Référence/).textContent ?? ''
}

describe('la référence marché', () => {
  it('sort avec ses quatre réserves, jamais le prix seul', () => {
    render(<ListingAssessmentCard assessment={evaluation()} />)

    const ligne = ligneDeReference()
    // Virgule décimale et espace fine insécable devant le symbole : l'écriture française (lot 148).
    expect(ligne).toMatch(/50,00\s€/)
    expect(ligne).toContain('confiance bonne')
    expect(ligne).toContain('3 annonces comparables')
    expect(ligne).toContain('resserrés à 12 % près')
    expect(ligne).toContain('le plus récent le 20/08/2026')
  })

  it('dit toujours d’où vient le chiffre : des relevés, pas des ventes conclues', () => {
    render(<ListingAssessmentCard assessment={evaluation()} />)

    expect(ligneDeReference()).toContain('pas des ventes conclues')
  })

  it('tait les réserves d’une analyse qui ne les portait pas, sans rien inventer', () => {
    // Une analyse antérieure au Lot 88 : le prix et l'échantillon restent, la
    // dispersion et la fraîcheur ne s'affichent pas plutôt que de valoir 0.
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

describe('l’absence de référence', () => {
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

  it('distingue « des relevés existent » de « aucune donnée »', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ ...sansReference, referenceGap: 'NO_COMPARABLE_SHAPE', referenceExaminedCount: 3 })}
      />,
    )

    expect(screen.getByText(/aucun sur un lot comparable/)).toHaveTextContent(
      '3 prix relevés examinés pour cette édition',
    )
  })

  it('ne parle pas de relevés examinés quand il n’y en a aucun', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ ...sansReference, referenceGap: 'NO_OBSERVATION', referenceExaminedCount: 0 })}
      />,
    )

    expect(screen.getByText(/Aucun prix relevé sur cette édition/)).toBeInTheDocument()
    expect(screen.queryByText(/examiné/)).not.toBeInTheDocument()
  })

  it('n’affiche aucun prix de référence quand elle est inexploitable', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ ...sansReference, referenceGap: 'NO_OBSERVATION', referenceExaminedCount: 0 })}
      />,
    )

    expect(screen.getByText('Référence insuffisante')).toBeInTheDocument()
    expect(screen.queryByText(/50,00\s€/)).not.toBeInTheDocument()
  })

  it('une provenance non conservée ne se lit pas comme un prix de marché', () => {
    render(
      <ListingAssessmentCard
        assessment={evaluation({ referenceSource: 'NOT_RECORDED', referenceSpreadPercent: null })}
      />,
    )

    expect(screen.getByText(/Estimation utilisée lors de cette analyse/)).toBeInTheDocument()
    expect(screen.queryByText(/confiance bonne/)).not.toBeInTheDocument()
  })
})

describe('le coût par élément', () => {
  it('prévient que les coûts sont sous-évalués quand la livraison est inconnue', () => {
    render(<ListingAssessmentCard assessment={evaluation()} shippingKind="UNKNOWN" />)

    expect(screen.getByText('Livraison non incluse : ces coûts sont sous-évalués.')).toBeInTheDocument()
  })

  it('dit « au moins » quand le port n’est qu’un « à partir de »', () => {
    render(<ListingAssessmentCard assessment={evaluation()} shippingKind="FROM" />)

    expect(screen.getByText(/au moins/)).toHaveTextContent('5,00 € / élément')
  })

  it('ne répète pas le coût utile quand aucun doublon ne le distingue', () => {
    const sansDoublon = evaluation()
    sansDoublon.collectionFit = { ...sansDoublon.collectionFit, pricePerUsefulItem: 5 }

    render(<ListingAssessmentCard assessment={sansDoublon} />)

    expect(screen.queryByText(/réellement utile/)).not.toBeInTheDocument()
  })
})
