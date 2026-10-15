import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { missingVolumes, ownsVolume, range } from '../src/collection.ts'
import { sampleCollection } from '../src/sample-collection.ts'

describe('range', () => {
  it('is inclusive and empty when the bounds are reversed', () => {
    assert.deepEqual(range(3, 5), [3, 4, 5])
    assert.deepEqual(range(5, 3), [])
  })
})

describe('ownsVolume', () => {
  it('answers for every edition when none is given', () => {
    assert.deepEqual(ownsVolume(sampleCollection, { series: 'Fullmetal Alchemist', volume: 3 }), {
      kind: 'ok',
      series: 'Fullmetal Alchemist',
      volume: 3,
      editions: [
        { edition: 'Perfect Edition', status: 'owned' },
        { edition: 'Édition classique', status: 'owned' },
        { edition: 'Collector', status: 'missing' },
      ],
    })
  })

  it('tells a missing volume from one the edition does not have', () => {
    const result = ownsVolume(sampleCollection, { series: 'Fullmetal Alchemist', volume: 9 })
    assert.equal(result.kind, 'ok')
    if (result.kind !== 'ok') return
    assert.deepEqual(
      result.editions.map((edition) => edition.status),
      ['missing', 'missing', 'out_of_range'],
    )
  })

  it('counts the last volume of an edition and rejects the one after it', () => {
    const statusOfVolume = (volume: number) => {
      const result = ownsVolume(sampleCollection, { series: 'Death Note', volume })
      return result.kind === 'ok' ? result.editions[0]?.status : result.kind
    }
    assert.equal(statusOfVolume(6), 'owned')
    assert.equal(statusOfVolume(7), 'out_of_range')
    assert.equal(statusOfVolume(0), 'out_of_range')
  })

  it('ignores case, accents and punctuation, and accepts a unique partial title', () => {
    assert.deepEqual(ownsVolume(sampleCollection, { series: 'fullmetal', volume: 2, edition: 'EDITION classique!' }), {
      kind: 'ok',
      series: 'Fullmetal Alchemist',
      volume: 2,
      editions: [{ edition: 'Édition classique', status: 'owned' }],
    })
  })

  it('reports a series that is not in the collection', () => {
    assert.deepEqual(ownsVolume(sampleCollection, { series: 'Berserk', volume: 1 }), {
      kind: 'unknown_series',
      query: 'Berserk',
    })
  })

  it('does not guess between several series', () => {
    assert.deepEqual(ownsVolume(sampleCollection, { series: 'dragon', volume: 1 }), {
      kind: 'ambiguous_series',
      query: 'dragon',
      candidates: ['Dragon Ball', 'Dragon Ball Super'],
    })
  })

  it('prefers an exact title over a longer one that contains it', () => {
    const result = ownsVolume(sampleCollection, { series: 'Dragon Ball', volume: 1 })
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') assert.equal(result.series, 'Dragon Ball')
  })

  it('lists the editions that exist when the requested one does not', () => {
    assert.deepEqual(ownsVolume(sampleCollection, { series: 'One Piece', volume: 1, edition: 'Collector' }), {
      kind: 'unknown_edition',
      series: 'One Piece',
      edition: 'Collector',
      availableEditions: ['Édition originale'],
    })
  })
})

describe('missingVolumes', () => {
  it('lists what is left to buy with the counts', () => {
    assert.deepEqual(missingVolumes(sampleCollection, { series: 'Chainsaw Man' }), {
      kind: 'ok',
      series: 'Chainsaw Man',
      editions: [{ edition: 'Édition Kazé', owned: 14, total: 17, missing: [15, 16, 17] }],
    })
  })

  it('returns no gap for a complete series', () => {
    const result = missingVolumes(sampleCollection, { series: 'Death Note' })
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') assert.deepEqual(result.editions[0]?.missing, [])
  })

  it('reports a whole edition as missing when nothing is owned', () => {
    const result = missingVolumes(sampleCollection, { series: 'Fullmetal Alchemist', edition: 'Collector' })
    assert.equal(result.kind, 'ok')
    if (result.kind === 'ok') assert.deepEqual(result.editions[0]?.missing, range(1, 6))
  })
})
