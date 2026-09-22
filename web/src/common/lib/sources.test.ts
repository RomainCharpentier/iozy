import { describe, expect, it } from 'vitest'
import { nomDeSource } from './sources'

describe('nomDeSource', () => {
  it('écrit le nom de la source comme elle s’appelle', () => {
    expect(nomDeSource('ANILIST')).toBe('AniList')
    expect(nomDeSource('GOOGLE_BOOKS')).toBe('Google Books')
    expect(nomDeSource('BGG')).toBe('BoardGameGeek')
  })

  it('laisse passer un code inconnu plutôt que de le cacher', () => {
    expect(nomDeSource('WIKIDATA')).toBe('WIKIDATA')
  })
})
