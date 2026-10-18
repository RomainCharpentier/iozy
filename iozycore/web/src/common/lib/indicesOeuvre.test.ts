/**
 * <b>The hints that we give back to a provider — and the one that we never
 * give.</b>
 *
 * These attributes tell "Naruto" apart from its eight spin-offs when a source
 * is queried again. Three screens extracted them again by hand, each with a
 * different subset: four for the volume search, only one for the cover
 * backfill, three for the French title. The same question asked with fewer
 * hints does not give a less precise answer - it gives a wrong answer.
 *
 * <p>And a deliberate exclusion: the `studio` of a video game does not enter
 * here. The callers query manga providers; a studio would be a <b>wrong</b>
 * hint there, not an extra hint.
 */
import { describe, expect, it } from 'vitest'
import { indicesDe } from './indicesOeuvre'

describe('indicesDe', () => {
  it('gathers the four hints of a manga series', () => {
    expect(indicesDe({ mangaka: 'Masashi Kishimoto', malId: '11', titleRomaji: 'Naruto' })).toEqual({
      author: 'Masashi Kishimoto',
      malId: '11',
      titleRomaji: 'Naruto',
      originalTitle: 'Naruto',
    })
  })

  it('does not take the studio of a video game as an author', () => {
    expect(indicesDe({ studio: 'Supergiant Games' }).author).toBeUndefined()
  })

  it('falls back on the English title when the romaji is missing', () => {
    // It is the original title that finds the editions at providers that do
    // not index the French title.
    const indices = indicesDe({ titleEnglish: 'Attack on Titan' })

    expect(indices.titleRomaji).toBeUndefined()
    expect(indices.originalTitle).toBe('Attack on Titan')
  })

  it('prefers the romaji over the English when both exist', () => {
    expect(indicesDe({ titleRomaji: 'Shingeki no Kyojin', titleEnglish: 'Attack on Titan' }).originalTitle)
      .toBe('Shingeki no Kyojin')
  })

  it('ignores an empty or blank string: an empty hint is a wrong one', () => {
    expect(indicesDe({ mangaka: '   ', malId: '' })).toEqual({
      author: undefined,
      malId: undefined,
      titleRomaji: undefined,
      originalTitle: undefined,
    })
  })

  it('only returns absent hints for a work entered by hand', () => {
    expect(indicesDe(undefined).author).toBeUndefined()
    expect(indicesDe({}).originalTitle).toBeUndefined()
  })
})
