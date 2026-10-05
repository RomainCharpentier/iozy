/**
 * <b>What we know about a series, and what we refuse to claim.</b>
 *
 * These two attributes come from an external source and do not always exist:
 * a series added by hand has none, and the total number of volumes is
 * only stored for series for which the provider has closed the count.
 *
 * <p>The rule is therefore the same everywhere in this repository, and it is the one that
 * breaks silently: <b>never claim a status that is not known</b>.
 * `null` is not "ongoing" by default - this is what prevents an "X/Y"
 * from being shown with a guessed denominator.
 */
import { describe, expect, it } from 'vitest'
import { isSeriesOngoing, totalVolumesFrom } from './seriesInfo'

describe('totalVolumesFrom', () => {
  it('returns the total when the source has closed it', () => {
    expect(totalVolumesFrom({ totalVolumes: 72 })).toBe(72)
  })

  it('refuses 0, a negative, a text, or absence', () => {
    expect(totalVolumesFrom({ totalVolumes: 0 })).toBeNull()
    expect(totalVolumesFrom({ totalVolumes: -3 })).toBeNull()
    expect(totalVolumesFrom({ totalVolumes: '72' })).toBeNull()
    expect(totalVolumesFrom({})).toBeNull()
    expect(totalVolumesFrom(undefined)).toBeNull()
  })
})

describe('isSeriesOngoing', () => {
  it('understands the two source vocabularies, never unified on the server side', () => {
    expect(isSeriesOngoing({ seriesStatus: 'Publishing' })).toBe(true)
    expect(isSeriesOngoing({ seriesStatus: 'currently_publishing' })).toBe(true)
    expect(isSeriesOngoing({ seriesStatus: 'Finished' })).toBe(false)
    expect(isSeriesOngoing({ seriesStatus: 'finished' })).toBe(false)
  })

  it('returns null - and not false - on a status it cannot read', () => {
    // "on_hiatus", "discontinued": neither ongoing nor finished. Deciding
    // would amount to inventing.
    expect(isSeriesOngoing({ seriesStatus: 'on_hiatus' })).toBeNull()
    expect(isSeriesOngoing({ seriesStatus: 'discontinued' })).toBeNull()
    expect(isSeriesOngoing({})).toBeNull()
    expect(isSeriesOngoing(undefined)).toBeNull()
  })
})
