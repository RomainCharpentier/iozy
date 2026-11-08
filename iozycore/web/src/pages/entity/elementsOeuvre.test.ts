/**
 * <b>The entity page reads a work the same way for every type.</b>
 *
 * The gesture on a missing element follows what the data allows, never a type
 * code; a paused work says it counts nothing; a total says where it comes from.
 */
import { describe, expect, it } from 'vitest'
import type { WorkDto, WorkElementDto } from '@/common/types/api'
import { edition } from '@/test/fixtures'
import {
  editionComptee,
  elementsAMettreDeCote,
  gesteJeLAi,
  phraseDesManques,
  phraseProchaineSortie,
  provenanceDuTotal,
} from './elementsOeuvre'

function element(options: Partial<WorkElementDto> & { key: string }): WorkElementDto {
  return {
    label: options.key,
    number: null,
    coverImageUrl: null,
    state: 'MISSING',
    releaseDate: null,
    variantId: null,
    ownershipId: null,
    countedAsMissing: true,
    ...options,
  }
}

function oeuvre(options: Partial<WorkDto> = {}): WorkDto {
  return {
    entityId: 'e',
    entityTypeId: 't',
    title: 'Frieren',
    coverImageUrl: null,
    collectorStatus: 'ONGOING',
    ownedCount: 10,
    totalCount: 14,
    missingCount: 4,
    totalKnown: true,
    elements: [],
    nextRelease: null,
    lastMovedAt: null,
    ...options,
  }
}

describe('the gesture on an element not owned', () => {
  it('owns an element the source declares ownable, whatever its type', () => {
    expect(gesteJeLAi(element({ key: 'variant-1', ownable: true }), false)).toBe('element')
  })

  it('adds the work itself whole', () => {
    expect(gesteJeLAi(element({ key: 'work' }), false)).toBe('oeuvre')
  })

  it('adds a volume by its number when the work is counted in editions', () => {
    expect(gesteJeLAi(element({ key: 'volume-2', number: 2 }), true)).toBe('numero')
  })

  it('offers nothing when no path can own it: a numbered variant of a work without editions', () => {
    expect(gesteJeLAi(element({ key: 'variant-2', number: 2 }), false)).toBeNull()
    expect(gesteJeLAi(element({ key: 'variant-2', ownable: false }), false)).toBeNull()
  })

  it('offers no "je l\'ai" on what is owned', () => {
    expect(gesteJeLAi(element({ key: 'volume-1', number: 1, state: 'OWNED', ownable: true }), true)).toBeNull()
  })
})

describe('the line under the count', () => {
  it('says how many are missing', () => {
    expect(phraseDesManques(oeuvre())).toBe('Il t’en manque 4')
  })

  it('says a paused or dropped work counts nothing, even with gaps', () => {
    expect(phraseDesManques(oeuvre({ collectorStatus: 'PAUSED', missingCount: 0 }))).toBe(
      'En pause : ce qui manque ne compte plus',
    )
    expect(phraseDesManques(oeuvre({ collectorStatus: 'DROPPED', missingCount: 0 }))).toBe(
      'Abandonnée : ce qui manque ne compte plus',
    )
  })

  it('says complete only when the total is known and reached', () => {
    expect(phraseDesManques(oeuvre({ ownedCount: 14, missingCount: 0 }))).toBe('Complet')
    expect(phraseDesManques(oeuvre({ totalCount: null, totalKnown: false, missingCount: 0 }))).toBe(
      'Rien ne manque à ce qui est connu',
    )
  })
})

describe('the next release', () => {
  it('names the element, the day and the price', () => {
    expect(
      phraseProchaineSortie({ date: '2026-12-04', precision: 'DAY', label: 'Tome 15', volumeNumber: 15, price: 7.95 }),
    ).toMatch(/^Tome 15 · vendredi 4 décembre · 7,95\s€$/)
  })

  it('says only the month when only the month is known, and the work itself without a label', () => {
    expect(phraseProchaineSortie({ date: '2026-12', precision: 'MONTH', label: '', volumeNumber: null, price: null })).toBe(
      'Sort en décembre 2026',
    )
  })
})

describe('the total of the counted edition', () => {
  it('counts the followed edition first, then the one with the most owned volumes', () => {
    const kana = edition({ nom: 'Kana', possedes: [1], total: 10 })
    const perfect = edition({ nom: 'Perfect', possedes: [1, 2, 3], total: 5 })
    expect(editionComptee([kana, perfect], 'kana')?.editionName).toBe('Kana')
    expect(editionComptee([kana, perfect], null)?.editionName).toBe('Perfect')
    expect(editionComptee([], null)).toBeNull()
  })

  it('says where a known total comes from, and nothing for an unknown one', () => {
    expect(provenanceDuTotal({ ...edition({ possedes: [], total: 12 }), totalSource: 'MANUAL' })).toBe('saisi par toi')
    expect(provenanceDuTotal({ ...edition({ possedes: [], total: 12 }), totalSource: 'PROVIDER' })).toBe(
      'd’après les listes françaises',
    )
    expect(provenanceDuTotal({ ...edition({ possedes: [], total: null }), totalSource: 'MANUAL' })).toBeNull()
  })
})

describe('what can be set aside', () => {
  it('is what counts as missing, and nothing for a paused work', () => {
    const elements = [
      element({ key: 'a' }),
      element({ key: 'b', state: 'WANTED' }),
      element({ key: 'c', state: 'UPCOMING', countedAsMissing: false }),
    ]
    expect(elementsAMettreDeCote(oeuvre({ elements })).map((e) => e.key)).toEqual(['a'])
    expect(elementsAMettreDeCote(oeuvre({ elements, collectorStatus: 'PAUSED' }))).toEqual([])
  })
})
