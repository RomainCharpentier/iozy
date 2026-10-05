import { describe, expect, it } from 'vitest'
import { nomDeSource } from './sources'

describe('nomDeSource', () => {
  it('writes the name of the source as it is called', () => {
    expect(nomDeSource('ANILIST')).toBe('AniList')
    expect(nomDeSource('GOOGLE_BOOKS')).toBe('Google Books')
    expect(nomDeSource('BGG')).toBe('BoardGameGeek')
  })

  it('lets an unknown code through rather than hiding it', () => {
    expect(nomDeSource('WIKIDATA')).toBe('WIKIDATA')
  })
})
