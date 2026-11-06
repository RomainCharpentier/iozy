/**
 * <b>The rules of a room, those that the eye would not catch.</b>
 * A hole in a series must never be invented, a long series must not become a
 * wall, and a shelf must never be wider than its room.
 */
import { describe, expect, it } from 'vitest'
import { edition, oeuvre, tome } from '@/test/fixtures'
import {
  couperEnRangees,
  dosDeLOeuvre,
  largeurObjet,
  mesuresDeLaSalle,
  CONSOLE_A_PRECISER,
  EDITEUR_INCONNU,
  pisteDeLOeuvre,
  rangerLaSalle,
  ratioDeLAspect,
  tomesManquants,
} from './salles'

describe('tomesManquants', () => {
  it('counts up to the known total', () => {
    expect(tomesManquants(edition({ possedes: [1, 2], total: 4 }))).toEqual([3, 4])
  })

  it('with an unknown total, only the holes between owned volumes are missing', () => {
    expect(tomesManquants(edition({ possedes: [1, 3], total: null }))).toEqual([2])
    expect(tomesManquants(edition({ possedes: [1, 2, 3], total: null }))).toEqual([])
  })

  it('a work without an edition lacks nothing', () => {
    expect(tomesManquants(null)).toEqual([])
  })
})

describe('dosDeLOeuvre', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1, { jaquette: 'un.jpg' }), tome(2), tome(5)] })

  it('stands the owned volumes, each with its own cover when it has one', () => {
    const dos = dosDeLOeuvre(serie, edition({ possedes: [1, 2], total: 2 }), new Set(), 12)

    expect(dos.map((d) => [d.numero, d.etat, d.jaquetteUrl])).toEqual([
      [1, 'possede', 'un.jpg'],
      [2, 'possede', null],
    ])
  })

  it('does not take the cover nor the wish of another edition', () => {
    const deuxEditions = oeuvre({
      titre: 'Monster',
      tomes: [tome(1, { edition: 'Kana', jaquette: 'kana.jpg' }), tome(2, { edition: 'Kana' }), tome(1, { edition: 'Glénat', jaquette: 'glenat.jpg' })],
    })
    deuxEditions.variants[0].id = 'kana-1'
    deuxEditions.variants[1].id = 'kana-2'
    deuxEditions.variants[2].id = 'glenat-1'

    const dos = dosDeLOeuvre(deuxEditions, edition({ nom: 'Glénat', possedes: [1], total: 1 }), new Set(['kana-2']), 12)

    expect(dos.map((d) => [d.numero, d.etat, d.jaquetteUrl])).toEqual([[1, 'possede', 'glenat.jpg']])
  })

  it('never makes a wall: at most three empty slots, the wanted ones kept first', () => {
    const dos = dosDeLOeuvre(serie, edition({ possedes: [1], total: 40 }), new Set(['tome-5']), 12)
    const vides = dos.filter((d) => d.etat !== 'possede')

    expect(vides.map((d) => d.numero)).toEqual([2, 3, 5])
    expect(vides.find((d) => d.numero === 5)?.etat).toBe('voulu')
  })

  it('caps the owned spines', () => {
    const numeros = Array.from({ length: 30 }, (_, i) => i + 1)
    const dos = dosDeLOeuvre(serie, edition({ possedes: numeros, total: 30 }), new Set(), 12)

    expect(dos).toHaveLength(12)
  })

  it('has none in the compact view, nor for a work that is one piece', () => {
    expect(dosDeLOeuvre(serie, edition({ possedes: [1], total: 2 }), new Set(), 0)).toEqual([])
    expect(dosDeLOeuvre(oeuvre({ titre: 'Hades' }), null, new Set(), 12)).toEqual([])
  })
})

describe('pisteDeLOeuvre', () => {
  it('draws one run per group of consecutive volumes', () => {
    expect(pisteDeLOeuvre(edition({ possedes: [1, 2, 4], total: 4 }))).toEqual([
      { debut: 0, largeur: 50 },
      { debut: 75, largeur: 25 },
    ])
  })

  it('stays silent when nothing is known to be missing', () => {
    expect(pisteDeLOeuvre(edition({ possedes: [1, 2, 3], total: null }))).toBeNull()
  })

  it('still shows a hole when the total is unknown', () => {
    expect(pisteDeLOeuvre(edition({ possedes: [1, 3], total: null }))).toHaveLength(2)
  })
})

describe('couperEnRangees', () => {
  const largeurDe = (taille: number) => taille

  it('never makes a shelf wider than the room', () => {
    const rangees = couperEnRangees([100, 100, 100, 100], largeurDe, 320, 10)

    expect(rangees.map((r) => r.objets.length)).toEqual([3, 1])
  })

  it('spreads every full shelf, and leaves a short last one on the left', () => {
    const rangees = couperEnRangees([100, 100, 100, 100], largeurDe, 320, 10)

    expect(rangees.map((r) => r.etalee)).toEqual([true, false])
  })

  it('an object wider than the room still gets its shelf', () => {
    expect(couperEnRangees([500, 100], largeurDe, 320, 10).map((r) => r.objets)).toEqual([[500], [100]])
  })

  it('makes one shelf before the width is known, and none for nothing', () => {
    expect(couperEnRangees([100, 100], largeurDe, 0, 10)).toHaveLength(1)
    expect(couperEnRangees([], largeurDe, 320, 10)).toEqual([])
  })
})

describe('rangerLaSalle', () => {
  const jeu = (titre: string, consoles: string[], editeur: string | null) => ({ titre, consoles, editeur })

  it('puts the video games by console then publisher, the largest first', () => {
    const sections = rangerLaSalle('VIDEO_GAME', [
      jeu('Elden Ring', ['PS5'], 'Bandai Namco'),
      jeu('Celeste', ['Switch'], 'Maddy Makes Games'),
      jeu('Zelda', ['Switch'], 'Nintendo'),
      jeu('Mario', ['Switch'], 'Nintendo'),
    ])

    expect(sections.map((s) => s.console)).toEqual(['Switch', 'PS5'])
    expect(sections[0].lots.map((l) => [l.editeur, l.objets.map((o) => o.titre)])).toEqual([
      ['Nintendo', ['Zelda', 'Mario']],
      ['Maddy Makes Games', ['Celeste']],
    ])
  })

  it('shows a game owned on two consoles under each', () => {
    const sections = rangerLaSalle('VIDEO_GAME', [jeu('Hades', ['PC', 'Switch'], 'Supergiant')])

    expect(sections.map((s) => s.console).sort()).toEqual(['PC', 'Switch'])
  })

  it('never guesses: what is not said waits at the end, even when it is the largest', () => {
    const sections = rangerLaSalle('VIDEO_GAME', [
      jeu('A', [], null),
      jeu('B', [], null),
      jeu('C', ['PC'], 'Valve'),
      jeu('D', ['PC'], null),
      jeu('E', ['PC'], null),
    ])

    expect(sections.map((s) => s.console)).toEqual(['PC', CONSOLE_A_PRECISER])
    expect(sections[0].lots.map((l) => l.editeur)).toEqual(['Valve', EDITEUR_INCONNU])
  })

  it('puts the board games by publisher, without a console', () => {
    const sections = rangerLaSalle('BOARD_GAME', [jeu('Catan', [], 'KOSMOS'), jeu('Azul', [], null)])

    expect(sections).toHaveLength(1)
    expect(sections[0].console).toBeNull()
    expect(sections[0].lots.map((l) => l.editeur)).toEqual(['KOSMOS', EDITEUR_INCONNU])
  })

  it('leaves the mangas and the custom types as they come, without a label', () => {
    for (const code of ['MANGA', 'VINYL']) {
      const objets = [jeu('Berserk', [], 'Glénat'), jeu('Monster', [], 'Kana')]
      expect(rangerLaSalle(code, objets)).toEqual([{ console: null, lots: [{ editeur: null, objets }] }])
    }
  })
})

describe('the sizes', () => {
  it('reads the ratio of every offered cover format', () => {
    expect(ratioDeLAspect('aspect-[2/3]')).toBeCloseTo(2 / 3)
    expect(ratioDeLAspect('aspect-square')).toBe(1)
    expect(ratioDeLAspect('aspect-[16/9]')).toBeCloseTo(16 / 9)
  })

  it('counts the spines in the width of an object', () => {
    const mesures = mesuresDeLaSalle('etageres', 1200)

    expect(largeurObjet(2 / 3, 10, mesures)).toBeGreaterThan(largeurObjet(2 / 3, 0, mesures))
  })

  it('the compact view is smaller than the shelves, on every screen', () => {
    for (const largeur of [390, 1280]) {
      expect(mesuresDeLaSalle('compact', largeur).hauteur).toBeLessThan(mesuresDeLaSalle('etageres', largeur).hauteur)
    }
  })
})
