import { describe, expect, it } from 'vitest'
import type { ToBuyElementDto, ToBuyLineDto } from '@/common/types/api'
import { detailDepense, etatBudget, libelleElements, libelleMoisDepense, sousTitreLigne, titreLigne } from './libelles'

function tome(n: number, state: ToBuyElementDto['state'] = 'MISSING'): ToBuyElementDto {
  return { key: `volume-${n}`, label: `Tome ${n}`, number: n, coverImageUrl: null, state, releaseDate: null }
}

function ligne(patch: Partial<ToBuyLineDto>): ToBuyLineDto {
  return {
    entityId: 'e1',
    entityTypeId: 't1',
    title: 'Frieren',
    coverImageUrl: null,
    kind: 'COMPLETE',
    collectorStatus: 'ONGOING',
    releaseDate: null,
    releasePrecision: null,
    elements: [tome(11)],
    ...patch,
  }
}

describe('the words of the to-buy page', () => {
  it('names the missing volumes the way one says them', () => {
    expect(libelleElements([tome(11), tome(12)])).toBe('Tomes 11 et 12')
    expect(libelleElements([tome(3), tome(4), tome(5), tome(6)])).toBe('Tomes 3 à 6')
    expect(libelleElements([tome(2), tome(5), tome(9)])).toBe('Tomes 2, 5 et 9')
    expect(libelleElements([tome(1), tome(3), tome(5), tome(7), tome(9)])).toBe('Tomes 1, 3, 5… (5 au total)')
  })

  it('names other elements by their labels, for any type', () => {
    const marins = { ...tome(0), key: 'variant-a', label: 'Marins', number: null }
    const villes = { ...tome(0), key: 'variant-b', label: 'Villes et Chevaliers', number: null }
    expect(libelleElements([marins, villes])).toBe('Marins et Villes et Chevaliers')
  })

  it('titles a line with its work, and a whole work with its title alone', () => {
    expect(titreLigne(ligne({ elements: [tome(11), tome(12)] }))).toBe('Frieren, tomes 11 et 12')
    const entiere = ligne({ title: 'Catan', elements: [{ ...tome(0), key: 'work', label: 'Catan', number: null }] })
    expect(titreLigne(entiere)).toBe('Catan')
  })

  it('says why the line is there', () => {
    const sortie = ligne({ kind: 'UPCOMING', releaseDate: '2026-11-13', releasePrecision: 'DAY', elements: [tome(15, 'UPCOMING')] })
    expect(sousTitreLigne(sortie)).toBe('vendredi 13 novembre · ta série en cours')
    const precommande = ligne({ kind: 'UPCOMING', releaseDate: '2026-12', releasePrecision: 'MONTH', elements: [tome(4, 'WANTED')] })
    expect(sousTitreLigne(precommande)).toBe('en décembre 2026 · dans tes envies')
    expect(sousTitreLigne(ligne({ kind: 'WISH', elements: [tome(3, 'WANTED')] }))).toBe('dans tes envies')
    expect(sousTitreLigne(ligne({ elements: [tome(11), tome(12)] }))).toBe('il t’en manque 2')
  })

  it('says what the big number counts, and what it cannot', () => {
    expect(libelleMoisDepense('2026-11')).toBe('Dépensé en novembre')
    expect(detailDepense(0, 0)).toBe('Aucun achat noté ce mois-ci')
    expect(detailDepense(3, 0)).toBe('3 achats')
    expect(detailDepense(2, 1)).toBe('3 achats · 1 sans prix, non compté')
  })

  it('says what is left of the budget, or by how much it is over', () => {
    expect(etatBudget(42.3, 150).reste).toMatch(/^Il te reste 107,70\s€$/)
    expect(etatBudget(160, 150).reste).toMatch(/^Dépassé de 10,00\s€$/)
    expect(etatBudget(160, 150).part).toBe(1)
  })
})
