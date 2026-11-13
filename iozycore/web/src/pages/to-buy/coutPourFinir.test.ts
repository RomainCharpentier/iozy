import { describe, expect, it } from 'vitest'
import { coutPourFinir } from './coutPourFinir'
import type { ToBuyLineDto } from '@/common/types/api'
import type { NearCompleteSuggestionDto } from '@/common/types/purchaseAnalysis'

function ligne(numeros: number[], patch: Partial<ToBuyLineDto> = {}): ToBuyLineDto {
  return {
    entityId: 'pluto',
    entityTypeId: 'manga',
    title: 'Pluto',
    coverImageUrl: null,
    kind: 'COMPLETE',
    collectorStatus: 'ONGOING',
    releaseDate: null,
    releasePrecision: null,
    elements: numeros.map((n) => ({ key: `volume-${n}`, label: `Tome ${n}`, number: n, coverImageUrl: null, state: 'MISSING', releaseDate: null })),
    ...patch,
  }
}

function suggestion(patch: Partial<NearCompleteSuggestionDto> = {}): NearCompleteSuggestionDto {
  return {
    entityId: 'pluto',
    seriesTitle: 'Pluto',
    editionName: 'Standard',
    ownedCount: 6,
    totalVolumes: 8,
    missingCount: 2,
    missingVolumeNumbers: [7, 8],
    cataloguedMissingVolumeNumbers: [],
    estimatedCostToComplete: 18,
    costToCompleteBasis: 'THEORETICAL_ONLY',
    ...patch,
  }
}

describe('coutPourFinir', () => {
  it('says what the missing volumes cost, and on what basis', () => {
    expect(coutPourFinir(ligne([7, 8]), [suggestion()])).toMatch(/^~18,00\s€ \(théorique\)$/)
  })

  it('prices only the volumes of the line, when the edition misses more (some not out yet)', () => {
    // 4 missing in the edition for 36 €, 2 of them out: 18 € for the line.
    const quatre = suggestion({ missingCount: 4, missingVolumeNumbers: [7, 8, 9, 10], estimatedCostToComplete: 36 })
    expect(coutPourFinir(ligne([7, 8]), [quatre])).toMatch(/^~18,00\s€/)
  })

  it('takes the edition that holds the volumes of the line', () => {
    const autre = suggestion({ editionName: 'Deluxe', missingVolumeNumbers: [1, 2], estimatedCostToComplete: 50, costToCompleteBasis: 'OBSERVED_MARKET' })
    expect(coutPourFinir(ligne([7, 8]), [autre, suggestion()])).toMatch(/théorique/)
  })

  it('says nothing without a priced edition, and nothing on a wish', () => {
    expect(coutPourFinir(ligne([7, 8]), [])).toBeNull()
    expect(coutPourFinir(ligne([7, 8]), [suggestion({ estimatedCostToComplete: null })])).toBeNull()
    expect(coutPourFinir(ligne([7, 8]), [suggestion({ entityId: 'autre' })])).toBeNull()
    expect(coutPourFinir(ligne([7, 8], { kind: 'WISH' }), [suggestion()])).toBeNull()
  })
})
