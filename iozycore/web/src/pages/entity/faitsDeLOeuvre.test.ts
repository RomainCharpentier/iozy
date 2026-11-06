/**
 * <b>A fact that is not known has no card.</b> A dash or a "0 min" would invent
 * something the source never said.
 */
import { describe, expect, it } from 'vitest'
import { faitsDeLOeuvre } from './faitsDeLOeuvre'

const libelles = (code: string, attributes: Record<string, unknown>) =>
  faitsDeLOeuvre(code, attributes).map((fait) => [fait.libelle, fait.valeur])

describe('the facts of a work', () => {
  it('says what a board game is', () => {
    expect(
      libelles('BOARD_GAME', { minPlayers: 2, maxPlayers: 4, averageDurationMinutes: 45, publisher: 'Next Move Games', designers: 'Michael Kiesling', yearPublished: '2017' }),
    ).toEqual([
      ['Joueurs', '2 à 4'],
      ['Durée', '45 min'],
      ['Éditeur', 'Next Move Games'],
      ['Auteur', 'Michael Kiesling'],
      ['Année', '2017'],
    ])
  })

  it('leaves out what is not known, or left at zero', () => {
    expect(libelles('BOARD_GAME', { averageDurationMinutes: 0, publisher: ' ' })).toEqual([])
    expect(libelles('VIDEO_GAME', {})).toEqual([])
  })

  it('reads the publisher and the studio of a video game', () => {
    expect(libelles('VIDEO_GAME', { publisher: 'Nintendo', studio: 'EPD' })).toEqual([
      ['Éditeur', 'Nintendo'],
      ['Studio', 'EPD'],
    ])
  })
})
