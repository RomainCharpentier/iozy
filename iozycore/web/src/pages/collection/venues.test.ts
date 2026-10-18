/**
 * <b>"Récents d'abord": since when is this object here?</b>
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
import { indexerVenues, trierOeuvres } from './venues'
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

describe('trierOeuvres', () => {
  const berserk = oeuvre({ titre: 'Berserk', tomes: [tome(1), tome(2)] })
  const pluto = oeuvre({ titre: 'Pluto', tomes: [tome(3)] })

  it('sorts by title following the French alphabet', () => {
    const ecole = oeuvre({ titre: 'École' })
    const zoo = oeuvre({ titre: 'Zoo' })
    const abc = oeuvre({ titre: 'Abc' })

    expect(trierOeuvres([zoo, ecole, abc], 'titre', indexerVenues([], [])).map((e) => e.title))
      .toEqual(['Abc', 'École', 'Zoo'])
  })

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

    expect(trierOeuvres([pluto, berserk], 'recent', venues).map((e) => e.title)).toEqual(['Berserk', 'Pluto'])
  })

  it('puts last a work whose arrival is unknown, without hiding it', () => {
    const venues = indexerVenues([possession({ entityId: pluto.id, variantId: 'tome-3' })], [])
    const inconnue = oeuvre({ titre: 'Blame' })

    expect(trierOeuvres([inconnue, pluto], 'recent', venues).map((e) => e.title)).toEqual(['Pluto', 'Blame'])
  })

  it('does not modify the list it is given', () => {
    // The entities come from the React Query cache: sorting them in place
    // would reorder the data shared by all the screens.
    const liste = [pluto, berserk]

    trierOeuvres(liste, 'titre', indexerVenues([], []))

    expect(liste.map((e) => e.title)).toEqual(['Pluto', 'Berserk'])
  })
})
