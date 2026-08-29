/**
 * <b>« Récents d'abord » : depuis quand cet objet est-il là ?</b>
 *
 * Deux colonnes de deux tables - la date d'acquisition d'une possession, la
 * date d'une envie - répondent à une seule question d'écran. Trois règles en
 * sortent, et aucune ne se voit quand elle tombe : la liste se contente d'être
 * dans le mauvais ordre.
 * <ul>
 *   <li>une possession l'emporte sur une envie pour le même objet : <b>avoir
 *       est postérieur à vouloir</b> ;</li>
 *   <li>une œuvre remonte à la venue de son tome le <b>plus récent</b> - sinon
 *       une série entamée il y a deux ans resterait au fond quoi qu'on y
 *       ajoute ;</li>
 *   <li>une possession revendue n'est pas une venue.</li>
 * </ul>
 */
import { describe, expect, it } from 'vitest'
import { indexerVenues, trierOeuvres } from './venues'
import { oeuvre, possession, tome } from '../../test/fixtures'
import type { WishlistEntryResponse } from '../../types/api'

function envie(entityId: string, variantId: string | null, addedAt: string): WishlistEntryResponse {
  return { id: `envie-${variantId ?? entityId}`, entityId, variantId, addedAt }
}

describe('indexerVenues', () => {
  it('indexe une possession par tome, et une possession d’œuvre par œuvre', () => {
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

  it('la possession l’emporte sur l’envie du même objet', () => {
    const venues = indexerVenues(
      [possession({ entityId: 'berserk', variantId: 'tome-1', acquiseLe: '2026-03-01' })],
      [envie('berserk', 'tome-1', '2025-01-01')],
    )

    expect(venues.parTome.get('tome-1')).toBe('2026-03-01')
  })

  it('retient la date de l’envie pour un objet seulement voulu', () => {
    const venues = indexerVenues([], [envie('berserk', 'tome-9', '2026-05-02')])

    expect(venues.parTome.get('tome-9')).toBe('2026-05-02')
  })

  it('ne compte pas une possession revendue comme une venue', () => {
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

  it('classe par titre en respectant l’alphabet français', () => {
    const ecole = oeuvre({ titre: 'École' })
    const zoo = oeuvre({ titre: 'Zoo' })
    const abc = oeuvre({ titre: 'Abc' })

    expect(trierOeuvres([zoo, ecole, abc], 'titre', indexerVenues([], [])).map((e) => e.title))
      .toEqual(['Abc', 'École', 'Zoo'])
  })

  it('remonte une vieille série quand un tome vient de s’y ajouter', () => {
    // C'est LE cas qui distingue « plus récent » de « plus ancien » : Berserk
    // est entamée depuis deux ans, mais son tome 2 est arrivé hier.
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

  it('range en dernier une œuvre dont on ignore la venue, sans la masquer', () => {
    const venues = indexerVenues([possession({ entityId: pluto.id, variantId: 'tome-3' })], [])
    const inconnue = oeuvre({ titre: 'Blame' })

    expect(trierOeuvres([inconnue, pluto], 'recent', venues).map((e) => e.title)).toEqual(['Pluto', 'Blame'])
  })

  it('ne modifie pas la liste qu’on lui donne', () => {
    // Les entités viennent du cache de React Query : les trier sur place
    // réordonnerait la donnée partagée par tous les écrans.
    const liste = [pluto, berserk]

    trierOeuvres(liste, 'titre', indexerVenues([], []))

    expect(liste.map((e) => e.title)).toEqual(['Pluto', 'Berserk'])
  })
})
