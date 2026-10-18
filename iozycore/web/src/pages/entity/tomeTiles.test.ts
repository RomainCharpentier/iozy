/**
 * <b>The volume grid: three states, and none guessed.</b>
 *
 * Owned, cataloged-but-not-owned, purely deduced from the total: three different
 * things, read by three surfaces (the dense grid, the summary of
 * the edition, the edition cards). Mixing them up has already produced a series
 * announced as 2/72 here and 3/72 there.
 *
 * <p>Two rules break particularly silently: without a known total, the
 * grid makes no deduced tile; and a volume really owned
 * BEYOND the announced total is still shown - hiding it would make the
 * data invisible and unrecoverable from the screen.
 */
import { describe, expect, it } from 'vitest'
import { buildTiles } from './tomeTiles'
import { edition, tome } from '@/test/fixtures'

describe('buildTiles', () => {
  it('deduces the missing volumes up to the known total', () => {
    const tuiles = buildTiles(edition({ possedes: [1, 3], catalogues: [1, 2, 3], total: 5 }), [])

    expect(tuiles.map((t) => `${t.volumeNumber}:${t.status}`)).toEqual([
      '1:owned',
      '2:cataloguedMissing',
      '3:owned',
      '4:virtualMissing',
      '5:virtualMissing',
    ])
  })

  it('without a known total, only shows what is really known', () => {
    const tuiles = buildTiles(edition({ possedes: [2], catalogues: [2, 7], total: null }), [])

    expect(tuiles.map((t) => `${t.volumeNumber}:${t.status}`)).toEqual(['2:owned', '7:cataloguedMissing'])
  })

  it('shows a volume beyond the announced total after the others rather than hiding it', () => {
    // The case of a volume entered with a number that is too big, or of a wrong edition
    // total: better to show the contradiction than to hide it.
    const tuiles = buildTiles(edition({ possedes: [1, 9], catalogues: [1, 9], total: 3 }), [])

    expect(tuiles.map((t) => t.volumeNumber)).toEqual([1, 2, 3, 9])
    expect(tuiles.at(-1)?.status).toBe('owned')
  })

  it('attaches to each tile the volume that matches it in the edition of the group', () => {
    const groupe = edition({ nom: 'Glénat', possedes: [1], catalogues: [1, 2], total: 2 })
    const tomes = [tome(1, { edition: 'Glénat' }), tome(2, { edition: 'Glénat' })]

    const tuiles = buildTiles(groupe, tomes)

    expect(tuiles.map((t) => t.variant?.id)).toEqual(['tome-1', 'tome-2'])
  })

  it('ignores a volume of ANOTHER edition than those of the group', () => {
    const groupe = edition({ nom: 'Glénat', possedes: [1], total: 1 })

    const tuiles = buildTiles(groupe, [tome(1, { edition: 'Deluxe' })])

    expect(tuiles[0].variant).toBeUndefined()
  })

  it('a volume that exists counts as "cataloged", even absent from the server list', () => {
    // A volume put in the wishes just now is cataloged just now: the network
    // answer, however, may be old. Without this rule it would fall back to a
    // purely deduced tile, with no identity to attach the wish to.
    const groupe = edition({ nom: 'Glénat', possedes: [], catalogues: [], total: 3 })

    const tuiles = buildTiles(groupe, [tome(2, { edition: 'Glénat' })])

    expect(tuiles.map((t) => t.status)).toEqual(['virtualMissing', 'cataloguedMissing', 'virtualMissing'])
    expect(tuiles[1].variant?.id).toBe('tome-2')
  })

  it('ignores a volume without a usable number', () => {
    const groupe = edition({ nom: 'Glénat', possedes: [1], total: 1 })

    const tuiles = buildTiles(groupe, [tome(null, { edition: 'Glénat', libelle: 'Coffret' })])

    expect(tuiles).toHaveLength(1)
    expect(tuiles[0].variant).toBeUndefined()
  })
})
