/**
 * <b>What moved last: since when is this object here?</b>
 *
 * Two columns of two tables - the acquisition date of an ownership, the
 * date of a wish - answer a single screen question. Three rules come
 * out of it, and none is visible when it breaks: the list is just
 * in the wrong order.
 * <ul>
 *   <li>an ownership wins over a wish for the same object: <b>having
 *       comes after wanting</b>;</li>
 *   <li>a work goes up to the arrival of its <b>most recent</b> volume - otherwise
 *       a series started two years ago would stay at the bottom whatever is
 *       added to it;</li>
 *   <li>a sold ownership is not an arrival.</li>
 * </ul>
 */
import { describe, expect, it } from 'vitest'
import { couvertureDuMoment, indexerVenues, plusRecentes } from './venues'
import { oeuvre, possession, tome } from '@/test/fixtures'
import type { WishlistEntryResponse } from '@/common/types/api'

function envie(entityId: string, variantId: string | null, addedAt: string): WishlistEntryResponse {
  return { id: `envie-${variantId ?? entityId}`, entityId, variantId, addedAt }
}

describe('indexerVenues', () => {
  it('indexes an ownership per volume, and a work ownership per work', () => {
    const venues = indexerVenues(
      [
        possession({ entityId: 'berserk', variantId: 'tome-1', acquiseLe: '2026-03-01' }),
        possession({ entityId: 'hades', acquiseLe: '2026-04-01' }),
      ],
      [],
    )

    expect(venues.parTome.get('tome-1')).toBe('2026-03-01')
    expect(venues.parOeuvre.get('hades')).toBe('2026-04-01')
  })

  it('the ownership wins over the wish for the same object', () => {
    const venues = indexerVenues(
      [possession({ entityId: 'berserk', variantId: 'tome-1', acquiseLe: '2026-03-01' })],
      [envie('berserk', 'tome-1', '2025-01-01')],
    )

    expect(venues.parTome.get('tome-1')).toBe('2026-03-01')
  })

  it('keeps the wish date for an object that is only wished', () => {
    const venues = indexerVenues([], [envie('berserk', 'tome-9', '2026-05-02')])

    expect(venues.parTome.get('tome-9')).toBe('2026-05-02')
  })

  it('does not count a sold ownership as an arrival', () => {
    const venues = indexerVenues(
      [possession({ entityId: 'berserk', variantId: 'tome-1', statut: 'SOLD', acquiseLe: '2026-03-01' })],
      [],
    )

    expect(venues.parTome.has('tome-1')).toBe(false)
  })
})

describe('plusRecentes', () => {
  const berserk = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2)] })
  const pluto = oeuvre({ titre: 'Pluto', tomes: [tome(3)] })

  it('brings an old series up when a volume has just been added to it', () => {
    // This is THE case that tells "more recent" from "older": Berserk
    // was started two years ago, but its volume 2 arrived yesterday.
    const venues = indexerVenues(
      [
        possession({ entityId: berserk.id, variantId: 'tome-1', acquiseLe: '2024-01-01' }),
        possession({ entityId: berserk.id, variantId: 'tome-2', acquiseLe: '2026-08-28' }),
        possession({ entityId: pluto.id, variantId: 'tome-3', acquiseLe: '2026-06-01' }),
      ],
      [],
    )

    expect(plusRecentes([pluto, berserk], venues, 10).map((e) => e.title)).toEqual(['Berserk', 'Pluto'])
  })

  it('keeps only what is asked, the most recent', () => {
    const venues = indexerVenues([possession({ entityId: pluto.id, variantId: 'tome-3' })], [])

    expect(plusRecentes([berserk, pluto], venues, 1).map((e) => e.title)).toEqual(['Pluto'])
  })

  it('stands the works of one day by title: the same order at every opening', () => {
    expect(plusRecentes([pluto, berserk], indexerVenues([], []), 10).map((e) => e.title)).toEqual(['Berserk', 'Pluto'])
  })

  it('does not modify the list it is given', () => {
    // The entities come from the React Query cache: sorting them in place
    // would reorder the data shared by all the screens.
    const liste = [pluto, berserk]

    plusRecentes(liste, indexerVenues([], []), 10)

    expect(liste.map((e) => e.title)).toEqual(['Pluto', 'Berserk'])
  })
})

describe('couvertureDuMoment', () => {
  const vinland = oeuvre({ titre: 'Vinland Saga', tomes: [tome(1)], jaquette: 'https://covers.example/vinland.jpg' })
  const sansJaquette = oeuvre({ titre: 'Zelda', tomes: [tome(2)] })
  const frieren = oeuvre({ titre: 'Frieren', tomes: [tome(3)], jaquette: 'https://covers.example/frieren.jpg' })

  it('wears the cover of the work that moved last', () => {
    const venues = indexerVenues(
      [
        possession({ entityId: vinland.id, variantId: 'tome-1', acquiseLe: '2026-01-01' }),
        possession({ entityId: frieren.id, variantId: 'tome-3', acquiseLe: '2026-11-01' }),
      ],
      [],
    )

    expect(couvertureDuMoment([vinland, frieren], venues)).toBe('https://covers.example/frieren.jpg')
  })

  it('passes over a work without a cover, to the next one that has one', () => {
    const venues = indexerVenues(
      [
        possession({ entityId: vinland.id, variantId: 'tome-1', acquiseLe: '2026-01-01' }),
        possession({ entityId: sansJaquette.id, variantId: 'tome-2', acquiseLe: '2026-11-01' }),
      ],
      [],
    )

    expect(couvertureDuMoment([vinland, sansJaquette], venues)).toBe('https://covers.example/vinland.jpg')
  })

  it('never wears the cover of a catalogue work that is not in the collection', () => {
    const venues = indexerVenues(
      [possession({ entityId: sansJaquette.id, variantId: 'tome-2', acquiseLe: '2026-11-01' })],
      [],
    )

    expect(couvertureDuMoment([vinland, sansJaquette], venues)).toBeNull()
    expect(couvertureDuMoment([frieren], indexerVenues([], []))).toBeNull()
  })

  it('has none when no work has a cover: the brand tones apply', () => {
    expect(couvertureDuMoment([sansJaquette], indexerVenues([], []))).toBeNull()
  })
})
