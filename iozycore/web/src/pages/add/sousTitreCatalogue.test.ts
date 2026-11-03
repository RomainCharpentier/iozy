import { describe, expect, it } from 'vitest'
import { sousTitreCatalogue } from './sousTitreCatalogue'

/**
 * <b>What a catalogue tile says under its title.</b>
 *
 * <p>Each universe names its year and its creator differently; the line must
 * read the same for all of them, and say nothing rather than a lone dash.
 */
describe('the subtitle of a catalogue tile', () => {
  it('reads the year and the creator of each universe', () => {
    expect(sousTitreCatalogue({ startYear: '1989', mangaka: 'Kentarou Miura' })).toBe('1989 · Kentarou Miura')
    expect(sousTitreCatalogue({ yearPublished: 2017, designers: 'R. Eric Reuss' })).toBe('2017 · R. Eric Reuss')
    expect(sousTitreCatalogue({ releaseDate: '2020-09-17', studio: 'Supergiant Games' })).toBe('2020 · Supergiant Games')
  })

  it('keeps the part it has, and says nothing with none', () => {
    expect(sousTitreCatalogue({ studio: 'Nintendo' })).toBe('Nintendo')
    expect(sousTitreCatalogue({ startYear: '2003' })).toBe('2003')
    expect(sousTitreCatalogue({ coverImageUrl: 'https://example.test/jaquette.jpg' })).toBeUndefined()
    expect(sousTitreCatalogue(undefined)).toBeUndefined()
  })

  it('ignores a year that is not one', () => {
    expect(sousTitreCatalogue({ startYear: '', mangaka: 'Naoki Urasawa' })).toBe('Naoki Urasawa')
    expect(sousTitreCatalogue({ releaseDate: 'bientôt' })).toBeUndefined()
  })
})
