/**
 * <b>What "owned" means — and what it does not mean.</b>
 *
 * Volume ≠ Ownership: a resold volume stays cataloged, its ownership does
 * not. Ma collection shows what one REALLY owns; it is the series detail
 * page that shows what is missing. Two screens, two questions, and confusing
 * the two would make a fully resold series reappear in the collection.
 */
import { describe, expect, it } from 'vitest'
import { isOwned, ownedVariantIds } from './ownership'
import { oeuvre, possession, tome } from '@/test/fixtures'

describe('ownedVariantIds', () => {
  it('only keeps the active ownerships', () => {
    const ids = ownedVariantIds([
      possession({ entityId: 'berserk', variantId: 'tome-1' }),
      possession({ entityId: 'berserk', variantId: 'tome-2', statut: 'SOLD' }),
      possession({ entityId: 'berserk', variantId: 'tome-3', statut: 'LOST' }),
    ])

    expect([...ids]).toEqual(['tome-1'])
  })

  it("ignores an ownership without a volume: it carries the work, not a volume", () => {
    // The case of a video game: the Ownership is attached to the Entity itself.
    expect(ownedVariantIds([possession({ entityId: 'hades' })]).size).toBe(0)
  })
})

describe('isOwned', () => {
  it('one single owned volume is enough for a series to be owned', () => {
    const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2)] })
    const owned = ownedVariantIds([possession({ entityId: serie.id, variantId: 'tome-2' })])

    expect(isOwned(serie, [], owned)).toBe(true)
  })

  it('a fully resold series is no longer owned', () => {
    const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1)] })
    const ventes = [possession({ entityId: serie.id, variantId: 'tome-1', statut: 'SOLD' })]

    expect(isOwned(serie, ventes, ownedVariantIds(ventes))).toBe(false)
  })

  it('a work without volumes is judged on its own ownership', () => {
    // Video game / board game: nothing to go through on the volume side,
    // everything depends on the Ownership attached to the Entity.
    const jeu = oeuvre({ titre: 'Hades', typeId: 'type-video-game' })

    expect(isOwned(jeu, [possession({ entityId: jeu.id })], new Set())).toBe(true)
    expect(isOwned(jeu, [possession({ entityId: jeu.id, statut: 'SOLD' })], new Set())).toBe(false)
    expect(isOwned(jeu, [possession({ entityId: 'autre-jeu' })], new Set())).toBe(false)
  })
})
