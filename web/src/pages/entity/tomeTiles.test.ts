/**
 * <b>La grille des tomes : trois états, et aucun deviné.</b>
 *
 * Possédé, catalogué-mais-pas-possédé, purement déduit du total : trois choses
 * différentes, que trois surfaces lisent (la grille dense, le résumé de
 * l'édition, les cartes d'édition). Les confondre a déjà produit une série
 * annoncée 2/72 ici et 3/72 là.
 *
 * <p>Deux règles se cassent particulièrement en silence : sans total connu, la
 * grille ne fabrique aucune tuile déduite ; et un tome réellement possédé
 * AU-DELÀ du total annoncé s'affiche quand même - l'escamoter rendrait la
 * donnée invisible et irrécupérable depuis l'écran.
 */
import { describe, expect, it } from 'vitest'
import { buildTiles } from './tomeTiles'
import { edition, tome } from '@/test/fixtures'

describe('buildTiles', () => {
  it('déduit les tomes manquants jusqu’au total connu', () => {
    const tuiles = buildTiles(edition({ possedes: [1, 3], catalogues: [1, 2, 3], total: 5 }), [])

    expect(tuiles.map((t) => `${t.volumeNumber}:${t.status}`)).toEqual([
      '1:owned',
      '2:cataloguedMissing',
      '3:owned',
      '4:virtualMissing',
      '5:virtualMissing',
    ])
  })

  it('sans total connu, ne montre que ce qu’on connaît réellement', () => {
    const tuiles = buildTiles(edition({ possedes: [2], catalogues: [2, 7], total: null }), [])

    expect(tuiles.map((t) => `${t.volumeNumber}:${t.status}`)).toEqual(['2:owned', '7:cataloguedMissing'])
  })

  it('montre à la suite un tome au-delà du total annoncé plutôt que de l’escamoter', () => {
    // Le cas d'un tome saisi avec un numéro trop grand, ou d'un total d'édition
    // faux : mieux vaut montrer la contradiction que la cacher.
    const tuiles = buildTiles(edition({ possedes: [1, 9], catalogues: [1, 9], total: 3 }), [])

    expect(tuiles.map((t) => t.volumeNumber)).toEqual([1, 2, 3, 9])
    expect(tuiles.at(-1)?.status).toBe('owned')
  })

  it('rattache à chaque tuile le tome qui lui correspond dans l’édition du groupe', () => {
    const groupe = edition({ nom: 'Glénat', possedes: [1], catalogues: [1, 2], total: 2 })
    const tomes = [tome(1, { edition: 'Glénat' }), tome(2, { edition: 'Glénat' })]

    const tuiles = buildTiles(groupe, tomes)

    expect(tuiles.map((t) => t.variant?.id)).toEqual(['tome-1', 'tome-2'])
  })

  it('ignore un tome d’une AUTRE édition que celles du groupe', () => {
    const groupe = edition({ nom: 'Glénat', possedes: [1], total: 1 })

    const tuiles = buildTiles(groupe, [tome(1, { edition: 'Deluxe' })])

    expect(tuiles[0].variant).toBeUndefined()
  })

  it('un tome qui existe vaut « catalogué », même absent de la liste du serveur', () => {
    // Un tome mis en envies à l'instant est catalogué à l'instant : la réponse
    // réseau, elle, peut dater. Sans cette règle il retomberait en tuile
    // purement déduite, sans identité à laquelle rattacher l'envie.
    const groupe = edition({ nom: 'Glénat', possedes: [], catalogues: [], total: 3 })

    const tuiles = buildTiles(groupe, [tome(2, { edition: 'Glénat' })])

    expect(tuiles.map((t) => t.status)).toEqual(['virtualMissing', 'cataloguedMissing', 'virtualMissing'])
    expect(tuiles[1].variant?.id).toBe('tome-2')
  })

  it('ignore un tome sans numéro exploitable', () => {
    const groupe = edition({ nom: 'Glénat', possedes: [1], total: 1 })

    const tuiles = buildTiles(groupe, [tome(null, { edition: 'Glénat', libelle: 'Coffret' })])

    expect(tuiles).toHaveLength(1)
    expect(tuiles[0].variant).toBeUndefined()
  })
})
