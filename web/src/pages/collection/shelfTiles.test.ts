/**
 * <b>Les règles de Ma collection, celles qu'aucun type ne protège.</b>
 *
 * Trois d'entre elles ont déjà coûté un bug documenté ou une décision produit
 * explicite, et toutes se cassent en silence :
 * <ul>
 *   <li>un total d'édition <b>inconnu</b> ne rend une série ni complète ni
 *       incomplète - la ranger d'un côté par défaut, c'est deviner ;</li>
 *   <li><b>un seul signal par carte</b>, jamais empilé : sous « Envies », le
 *       nombre de tomes voulus l'emporte sur « Plus que N tomes » ;</li>
 *   <li>un type <b>sans aucun titre</b> n'a pas de rail, et l'ordre des
 *       univers ne dépend pas de l'ordre d'arrivée du serveur.</li>
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
  trierTypes,
} from './shelfTiles'
import { ownedVariantIds } from '@/common/lib/ownership'
import { edition, oeuvre, possession, progressionDe, tome, typeDeCollection } from '@/test/fixtures'

const AUCUNE_PROGRESSION = new Map()

describe('buildShelfTile', () => {
  it('annonce « X/Y tomes » et le nom de l’édition quand le total est connu', () => {
    const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })
    const tuile = buildShelfTile(serie, progressionDe(serie, edition({ nom: 'Glénat', possedes: [1, 2], total: 41 })))

    expect(tuile.subtitle).toBe('Glénat · 2/41 tomes')
  })

  it('sans total connu, compte ce qu’on a sans inventer de dénominateur', () => {
    const serie = oeuvre({ titre: 'Vagabond', tomes: [tome(1)] })
    const tuile = buildShelfTile(serie, progressionDe(serie, edition({ possedes: [1, 2, 3], total: null })))

    expect(tuile.subtitle).toBe('3 tomes')
    expect(tuile.signal).toBeUndefined()
  })

  it('signale « Plus que N tomes » à trois tomes de la fin, pas à quatre', () => {
    const serie = oeuvre({ titre: 'Pluto', tomes: [tome(1)] })
    const aTrois = progressionDe(serie, edition({ possedes: [1, 2, 3, 4, 5], total: 8 }))
    const aQuatre = progressionDe(serie, edition({ possedes: [1, 2, 3, 4], total: 8 }))

    expect(buildShelfTile(serie, aTrois).signal).toBe('Plus que 3 tomes')
    expect(buildShelfTile(serie, aQuatre).signal).toBeUndefined()
  })

  it('ne dit pas « Plus que 0 tome » sur une série complète', () => {
    const serie = oeuvre({ titre: 'Pluto', tomes: [tome(1)] })
    const complete = progressionDe(serie, edition({ possedes: [1, 2, 3, 4, 5, 6, 7, 8], total: 8 }))

    expect(buildShelfTile(serie, complete).signal).toBeUndefined()
  })

  it('sous « Envies », les tomes voulus prennent le pas sur la fin de série', () => {
    // Les deux signaux sont vrais en même temps ; un seul doit s'afficher, et
    // c'est celui qui répond à la question posée par le filtre en cours.
    const serie = oeuvre({ titre: 'Pluto', tomes: [tome(1)] })
    const presqueComplete = progressionDe(serie, edition({ possedes: [1, 2, 3, 4, 5, 6], total: 8 }))

    expect(buildShelfTile(serie, presqueComplete, { possede: true, tomesVoulus: 2, prioritaire: true }).signal)
      .toBe('2 tomes voulus')
    expect(buildShelfTile(serie, presqueComplete, { possede: true, tomesVoulus: 2, prioritaire: false }).signal)
      .toBe('Plus que 2 tomes')
  })

  it('une série voulue sans aucun tome possédé ne s’annonce pas « 0 tome »', () => {
    const serie = oeuvre({ titre: 'Blame', tomes: [tome(1)] })

    expect(buildShelfTile(serie, AUCUNE_PROGRESSION, { possede: false, tomesVoulus: 1, prioritaire: true }).subtitle)
      .toBe('aucun tome encore')
  })

  it('une œuvre sans tome dit ce qu’elle est, pas combien on en a', () => {
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })

    expect(buildShelfTile(jeu, AUCUNE_PROGRESSION).subtitle).toBe('Possédé')
    expect(buildShelfTile(jeu, AUCUNE_PROGRESSION, { possede: false, tomesVoulus: 0, prioritaire: false }).subtitle)
      .toBe('Dans mes envies')
  })
})

describe('matchesCompletionFilter', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })

  it('classe une série dont le total est connu', () => {
    const incomplete = progressionDe(serie, edition({ possedes: [1], total: 41 }))
    const complete = progressionDe(serie, edition({ possedes: [1, 2], total: 2 }))

    expect(matchesCompletionFilter(serie, 'INCOMPLETE', incomplete)).toBe(true)
    expect(matchesCompletionFilter(serie, 'COMPLETE', incomplete)).toBe(false)
    expect(matchesCompletionFilter(serie, 'COMPLETE', complete)).toBe(true)
  })

  it('sort une série au total inconnu des DEUX filtres, jamais rangée par défaut', () => {
    const inconnu = progressionDe(serie, edition({ possedes: [1, 2], total: null }))

    expect(matchesCompletionFilter(serie, 'ALL', inconnu)).toBe(true)
    expect(matchesCompletionFilter(serie, 'COMPLETE', inconnu)).toBe(false)
    expect(matchesCompletionFilter(serie, 'INCOMPLETE', inconnu)).toBe(false)
  })
})

describe('trierTypes et groupByEntityType', () => {
  const manga = typeDeCollection('MANGA')
  const jeuVideo = typeDeCollection('VIDEO_GAME')
  const vinyle = typeDeCollection('VINYL')

  it('garde l’ordre des univers quel que soit celui du serveur', () => {
    expect(trierTypes([jeuVideo, vinyle, manga]).map((t) => t.code)).toEqual(['MANGA', 'VIDEO_GAME', 'VINYL'])
  })

  it('place un type créé plus tard à la fin, jamais masqué', () => {
    expect(trierTypes([vinyle, manga]).map((t) => t.code)).toEqual(['MANGA', 'VINYL'])
  })

  it('n’ouvre pas de rail pour un type sans aucun titre', () => {
    const serie = oeuvre({ titre: 'Berserk', typeId: manga.id, tomes: [tome(1)] })
    const sections = groupByEntityType([serie], [manga, jeuVideo], AUCUNE_PROGRESSION)

    expect(sections.map((s) => s.entityType.code)).toEqual(['MANGA'])
  })
})

describe('etatDeLOeuvre et correspondAuFiltre', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2)] })

  it('une œuvre est voulue dès qu’un seul de ses tomes l’est', () => {
    const etat = etatDeLOeuvre(serie, [], new Set(), new Set(['tome-2']), new Set())

    expect(etat).toEqual({ possede: false, voulu: true })
    expect(correspondAuFiltre(etat, 'envies')).toBe(true)
    expect(correspondAuFiltre(etat, 'possedes')).toBe(false)
    expect(correspondAuFiltre(etat, 'tout')).toBe(true)
  })

  it('possédée ET voulue reste les deux : « Tout » ne tranche pas', () => {
    const possessions = [possession({ entityId: serie.id, variantId: 'tome-1' })]
    const etat = etatDeLOeuvre(serie, possessions, ownedVariantIds(possessions), new Set(['tome-2']), new Set())

    expect(etat).toEqual({ possede: true, voulu: true })
    expect(correspondAuFiltre(etat, 'possedes')).toBe(true)
    expect(correspondAuFiltre(etat, 'envies')).toBe(true)
  })

  it('une œuvre sans tome peut être voulue en tant qu’œuvre', () => {
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })
    const etat = etatDeLOeuvre(jeu, [], new Set(), new Set(), new Set([jeu.id]))

    expect(etat).toEqual({ possede: false, voulu: true })
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

  it('ne sort que les tomes qui ont un état : ni possédé ni voulu n’existe pas ici', () => {
    const tuiles = aplatirEnElements([serie], 'tout', contexte)

    expect(tuiles.map((t) => t.key)).toEqual(['tome-1', 'tome-3'])
    expect(tuiles.map((t) => t.etat)).toEqual(['possede', 'voulu'])
  })

  it('distingue un tome voulu d’un tome possédé sous « Tout »', () => {
    const [possede, voulu] = aplatirEnElements([serie], 'tout', contexte)

    expect(possede.signal).toBeUndefined()
    expect(voulu.signal).toBe('Je le veux')
    expect(voulu.subtitle).toBe('Tome 3')
  })

  it('suit le filtre en cours', () => {
    expect(aplatirEnElements([serie], 'possedes', contexte).map((t) => t.key)).toEqual(['tome-1'])
    expect(aplatirEnElements([serie], 'envies', contexte).map((t) => t.key)).toEqual(['tome-3'])
  })

  it('une œuvre sans tome donne une seule tuile - elle EST déjà l’objet', () => {
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

  it('donne au tome un dégradé qui lui est propre, pas celui de la série', () => {
    const [premier, second] = aplatirEnElements([serie], 'tout', contexte)

    expect(premier.gradientKey).not.toBe(second.gradientKey)
  })
})
