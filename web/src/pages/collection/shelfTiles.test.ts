/**
 * <b>The rules of My collection, those that no type protects.</b>
 *
 * Three of them have already cost a documented bug or an explicit product
 * decision, and all of them break silently:
 * <ul>
 *   <li>an <b>unknown</b> edition total makes a series neither complete nor
 *       incomplete - putting it on one side by default is guessing;</li>
 *   <li><b>one single signal per card</b>, never stacked: under "Envies", the
 *       number of wished volumes wins over "Plus que N tomes";</li>
 *   <li>a type <b>without any title</b> has no rail, and the order of the
 *       universes does not depend on the order in which the server returns them.</li>
 * </ul>
 */
import { describe, expect, it } from 'vitest'
import {
  aplatirEnElements,
  buildShelfTile,
  correspondAuFiltre,
  etatDeLOeuvre,
  groupByEntityType,
  matchesCompletionFilter,
  ordonnerLesTypes,
} from './shelfTiles'
import { ownedVariantIds } from '@/common/lib/ownership'
import { edition, oeuvre, possession, progressionDe, tome, typeDeCollection } from '@/test/fixtures'

const AUCUNE_PROGRESSION = new Map()

describe('buildShelfTile', () => {
  it('announces "X/Y tomes" and the edition name when the total is known', () => {
    const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })
    const tuile = buildShelfTile(serie, progressionDe(serie, edition({ nom: 'Glénat', possedes: [1, 2], total: 41 })))

    expect(tuile.subtitle).toBe('2/41 tomes · Glénat')
  })

  it('without a known total, counts what we have without inventing a denominator', () => {
    const serie = oeuvre({ titre: 'Vagabond', tomes: [tome(1)] })
    const tuile = buildShelfTile(serie, progressionDe(serie, edition({ possedes: [1, 2, 3], total: null })))

    expect(tuile.subtitle).toBe('3 tomes')
    expect(tuile.signal).toBeUndefined()
  })

  it('shows "Plus que N tomes" at three volumes from the end, not at four', () => {
    const serie = oeuvre({ titre: 'Pluto', tomes: [tome(1)] })
    const aTrois = progressionDe(serie, edition({ possedes: [1, 2, 3, 4, 5], total: 8 }))
    const aQuatre = progressionDe(serie, edition({ possedes: [1, 2, 3, 4], total: 8 }))

    expect(buildShelfTile(serie, aTrois).signal).toBe('Plus que 3 tomes')
    expect(buildShelfTile(serie, aQuatre).signal).toBeUndefined()
  })

  it('does not say "Plus que 0 tome" on a complete series', () => {
    const serie = oeuvre({ titre: 'Pluto', tomes: [tome(1)] })
    const complete = progressionDe(serie, edition({ possedes: [1, 2, 3, 4, 5, 6, 7, 8], total: 8 }))

    expect(buildShelfTile(serie, complete).signal).toBeUndefined()
  })

  it('under "Envies", wished volumes take priority over the end of the series', () => {
    // Both signals are true at the same time; only one must be shown, and
    // it is the one that answers the question asked by the current filter.
    const serie = oeuvre({ titre: 'Pluto', tomes: [tome(1)] })
    const presqueComplete = progressionDe(serie, edition({ possedes: [1, 2, 3, 4, 5, 6], total: 8 }))

    expect(buildShelfTile(serie, presqueComplete, { possede: true, tomesVoulus: 2, prioritaire: true }).signal)
      .toBe('2 tomes voulus')
    expect(buildShelfTile(serie, presqueComplete, { possede: true, tomesVoulus: 2, prioritaire: false }).signal)
      .toBe('Plus que 2 tomes')
  })

  it('a series that is wished with no owned volume does not announce "0 tome"', () => {
    const serie = oeuvre({ titre: 'Blame', tomes: [tome(1)] })

    expect(buildShelfTile(serie, AUCUNE_PROGRESSION, { possede: false, tomesVoulus: 1, prioritaire: true }).subtitle)
      .toBe('aucun tome encore')
  })

  it('a work without volumes says what it is, not how many we have', () => {
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })

    expect(buildShelfTile(jeu, AUCUNE_PROGRESSION).subtitle).toBe('Possédé')
    expect(buildShelfTile(jeu, AUCUNE_PROGRESSION, { possede: false, tomesVoulus: 0, prioritaire: false }).subtitle)
      .toBe('Dans mes envies')
  })
})

describe('matchesCompletionFilter', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })

  it('classifies a series whose total is known', () => {
    const incomplete = progressionDe(serie, edition({ possedes: [1], total: 41 }))
    const complete = progressionDe(serie, edition({ possedes: [1, 2], total: 2 }))

    expect(matchesCompletionFilter(serie, 'INCOMPLETE', incomplete)).toBe(true)
    expect(matchesCompletionFilter(serie, 'COMPLETE', incomplete)).toBe(false)
    expect(matchesCompletionFilter(serie, 'COMPLETE', complete)).toBe(true)
  })

  it('takes a series with an unknown total out of BOTH filters, never put aside by default', () => {
    const inconnu = progressionDe(serie, edition({ possedes: [1, 2], total: null }))

    expect(matchesCompletionFilter(serie, 'ALL', inconnu)).toBe(true)
    expect(matchesCompletionFilter(serie, 'COMPLETE', inconnu)).toBe(false)
    expect(matchesCompletionFilter(serie, 'INCOMPLETE', inconnu)).toBe(false)
  })
})

describe('ordonnerLesTypes and groupByEntityType', () => {
  const manga = typeDeCollection('MANGA')
  const jeuVideo = typeDeCollection('VIDEO_GAME')
  const vinyle = typeDeCollection('VINYL')

  it('puts the type with the most titles first, whatever the server order', () => {
    const titres = new Map([
      [jeuVideo.id, 4],
      [manga.id, 12],
      [vinyle.id, 1],
    ])

    expect(ordonnerLesTypes([jeuVideo, vinyle, manga], titres).map((t) => t.code)).toEqual(['MANGA', 'VIDEO_GAME', 'VINYL'])
  })

  it('breaks a tie between two types by their label, never by an order written in the code', () => {
    const titres = new Map([
      [vinyle.id, 3],
      [manga.id, 3],
    ])
    const attendu = [manga, vinyle].map((t) => t.label).sort((a, b) => a.localeCompare(b, 'fr'))

    expect(ordonnerLesTypes([vinyle, manga], titres).map((t) => t.label)).toEqual(attendu)
    expect(ordonnerLesTypes([manga, vinyle], titres).map((t) => t.label)).toEqual(attendu)
  })

  it('a type created later is placed like the others, never hidden', () => {
    const serie = oeuvre({ titre: 'Berserk', typeId: manga.id, tomes: [tome(1)] })
    const disque = oeuvre({ titre: 'Abbey Road', typeId: vinyle.id, tomes: [] })
    const autre = oeuvre({ titre: 'Rumours', typeId: vinyle.id, tomes: [] })
    const sections = groupByEntityType([serie, disque, autre], [manga, vinyle], AUCUNE_PROGRESSION)

    expect(sections.map((s) => s.entityType.code)).toEqual(['VINYL', 'MANGA'])
  })

  it('does not open a rail for a type without any title', () => {
    const serie = oeuvre({ titre: 'Berserk', typeId: manga.id, tomes: [tome(1)] })
    const sections = groupByEntityType([serie], [manga, jeuVideo], AUCUNE_PROGRESSION)

    expect(sections.map((s) => s.entityType.code)).toEqual(['MANGA'])
  })
})

describe('etatDeLOeuvre and correspondAuFiltre', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2)] })

  it('a work is wished as soon as one single one of its volumes is', () => {
    const etat = etatDeLOeuvre(serie, [], new Set(), new Set(['tome-2']), new Set())

    expect(etat).toEqual({ possede: false, voulu: true, suivi: false })
    expect(correspondAuFiltre(etat, 'envies')).toBe(true)
    expect(correspondAuFiltre(etat, 'possedes')).toBe(false)
    expect(correspondAuFiltre(etat, 'tout')).toBe(true)
  })

  it('owned AND wished stays both: "Tout" does not decide', () => {
    const possessions = [possession({ entityId: serie.id, variantId: 'tome-1' })]
    const etat = etatDeLOeuvre(serie, possessions, ownedVariantIds(possessions), new Set(['tome-2']), new Set())

    expect(etat).toEqual({ possede: true, voulu: true, suivi: false })
    expect(correspondAuFiltre(etat, 'possedes')).toBe(true)
    expect(correspondAuFiltre(etat, 'envies')).toBe(true)
  })

  it('a work without volumes can be wished as a work', () => {
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })
    const etat = etatDeLOeuvre(jeu, [], new Set(), new Set(), new Set([jeu.id]))

    expect(etat).toEqual({ possede: false, voulu: true, suivi: false })
  })

  it('a followed work has its own state: under "Suivies" and under "Tout", not under "Envies"', () => {
    const jeu = oeuvre({ titre: 'Silksong', typeId: 'type-video-game' })
    const etat = etatDeLOeuvre(jeu, [], new Set(), new Set(), new Set(), new Set([jeu.id]))

    expect(etat).toEqual({ possede: false, voulu: false, suivi: true })
    expect(correspondAuFiltre(etat, 'suivies')).toBe(true)
    expect(correspondAuFiltre(etat, 'tout')).toBe(true)
    expect(correspondAuFiltre(etat, 'envies')).toBe(false)
    expect(correspondAuFiltre(etat, 'possedes')).toBe(false)
  })
})

describe('aplatirEnElements', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2), tome(3)] })
  const possessions = [possession({ entityId: serie.id, variantId: 'tome-1' })]
  const contexte = {
    ownerships: possessions,
    owned: ownedVariantIds(possessions),
    tomesVoulus: new Set(['tome-3']),
    oeuvresVoulues: new Set<string>(),
    depuisTome: () => '2026-02-01',
    depuisOeuvre: () => '2026-02-01',
  }

  it('only returns the volumes that have a state: neither owned nor wished does not exist here', () => {
    const tuiles = aplatirEnElements([serie], 'tout', contexte)

    expect(tuiles.map((t) => t.key)).toEqual(['tome-1', 'tome-3'])
    expect(tuiles.map((t) => t.etat)).toEqual(['possede', 'voulu'])
  })

  it('tells a wished volume from an owned volume under "Tout"', () => {
    const [possede, voulu] = aplatirEnElements([serie], 'tout', contexte)

    expect(possede.signal).toBeUndefined()
    expect(voulu.signal).toBe('Je le veux')
    expect(voulu.subtitle).toBe('Tome 3')
  })

  it('follows the current filter', () => {
    expect(aplatirEnElements([serie], 'possedes', contexte).map((t) => t.key)).toEqual(['tome-1'])
    expect(aplatirEnElements([serie], 'envies', contexte).map((t) => t.key)).toEqual(['tome-3'])
  })

  it('a work without volumes gives one single tile - it IS already the object', () => {
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })
    const possessionsJeu = [possession({ entityId: jeu.id })]

    const tuiles = aplatirEnElements([jeu], 'tout', {
      ...contexte,
      ownerships: possessionsJeu,
      owned: new Set(),
    })

    expect(tuiles).toHaveLength(1)
    expect(tuiles[0]).toMatchObject({ key: jeu.id, etat: 'possede', subtitle: 'Possédé' })
  })

  it('gives the volume a gradient of its own, not the one of the series', () => {
    const [premier, second] = aplatirEnElements([serie], 'tout', contexte)

    expect(premier.gradientKey).not.toBe(second.gradientKey)
  })
})
