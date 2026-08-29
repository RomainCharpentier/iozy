/**
 * <b>Ce que « possédé » veut dire — et ce que ça ne veut pas dire.</b>
 *
 * Tome ≠ Possession : un tome revendu reste catalogué, sa possession non. Ma
 * collection montre ce qu'on possède RÉELLEMENT ; c'est la fiche de la série
 * qui montre ce qui manque. Deux écrans, deux questions, et la confusion entre
 * les deux ferait réapparaître dans la collection une série entièrement
 * revendue.
 */
import { describe, expect, it } from 'vitest'
import { isOwned, ownedVariantIds } from './ownership'
import { oeuvre, possession, tome } from '../../test/fixtures'

describe('ownedVariantIds', () => {
  it('ne retient que les possessions actives', () => {
    const ids = ownedVariantIds([
      possession({ entityId: 'berserk', variantId: 'tome-1' }),
      possession({ entityId: 'berserk', variantId: 'tome-2', statut: 'SOLD' }),
      possession({ entityId: 'berserk', variantId: 'tome-3', statut: 'LOST' }),
    ])

    expect([...ids]).toEqual(['tome-1'])
  })

  it("ignore une possession sans tome : elle porte l'œuvre, pas un tome", () => {
    // Le cas d'un jeu vidéo : l'Ownership est rattachée à l'Entity elle-même.
    expect(ownedVariantIds([possession({ entityId: 'hades' })]).size).toBe(0)
  })
})

describe('isOwned', () => {
  it('suffit d’un seul tome possédé pour qu’une série le soit', () => {
    const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2)] })
    const owned = ownedVariantIds([possession({ entityId: serie.id, variantId: 'tome-2' })])

    expect(isOwned(serie, [], owned)).toBe(true)
  })

  it('une série entièrement revendue n’est plus possédée', () => {
    const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })
    const ventes = [possession({ entityId: serie.id, variantId: 'tome-1', statut: 'SOLD' })]

    expect(isOwned(serie, ventes, ownedVariantIds(ventes))).toBe(false)
  })

  it('une œuvre sans tome se juge sur sa propre possession', () => {
    // Jeu vidéo / jeu de société : rien à parcourir côté tomes, tout se joue
    // sur l'Ownership rattachée à l'Entity.
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })

    expect(isOwned(jeu, [possession({ entityId: jeu.id })], new Set())).toBe(true)
    expect(isOwned(jeu, [possession({ entityId: jeu.id, statut: 'SOLD' })], new Set())).toBe(false)
    expect(isOwned(jeu, [possession({ entityId: 'autre-jeu' })], new Set())).toBe(false)
  })
})
