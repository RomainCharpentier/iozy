import { describe, expect, it } from 'vitest'
import { bornesDuMois, compterParCategorie, moisDepuisParametre, moisPrecedent, moisSuivant, rangerParJour } from './releaseCalendar'
import type { ReleaseEntryDto } from '@/common/types/api'

function sortie(date: string, precision: 'DAY' | 'MONTH' = 'DAY', entityTypeId = 'type-manga'): ReleaseEntryDto {
  return {
    date,
    precision,
    entityId: `e-${date}-${Math.random()}`,
    entityTitle: 'Naruto',
    entityTypeId,
    label: 'Tome 72 · Kana',
    volumeNumber: 72,
    editionName: 'Kana',
    coverImageUrl: null,
    relation: 'MISSING',
    source: 'GOOGLE_BOOKS',
  }
}

describe('le mois regardé', () => {
  it('vient de l’URL quand elle est lisible, de l’appareil sinon', () => {
    const aujourdHui = new Date(2026, 8, 9)
    expect(moisDepuisParametre('2026-10', aujourdHui)).toBe('2026-10')
    expect(moisDepuisParametre(null, aujourdHui)).toBe('2026-09')
    expect(moisDepuisParametre('octobre', aujourdHui)).toBe('2026-09')
    expect(moisDepuisParametre('2026-13', aujourdHui)).toBe('2026-09')
  })

  it('a ses bornes incluses, février compris, et se tourne dans les deux sens', () => {
    expect(bornesDuMois('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(bornesDuMois('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(moisSuivant('2026-12')).toBe('2027-01')
    expect(moisPrecedent('2026-01')).toBe('2025-12')
  })
})

describe('rangerParJour', () => {
  it('groupe par jour dans l’ordre reçu, et met à part ce qui n’a pas de jour', () => {
    const range = rangerParJour([
      sortie('2026-10', 'MONTH'),
      sortie('2026-10-02'),
      sortie('2026-10-14'),
      sortie('2026-10-14'),
    ])

    expect(range.aPreciser).toHaveLength(1)
    expect(range.jours.map((j) => [j.iso, j.entries.length])).toEqual([
      ['2026-10-02', 1],
      ['2026-10-14', 2],
    ])
  })

  it('compte les sorties par catégorie', () => {
    const comptes = compterParCategorie([sortie('2026-10-02'), sortie('2026-10-03'), sortie('2026-10-03', 'DAY', 'type-jeu')])

    expect([...comptes.entries()]).toEqual([
      ['type-manga', 2],
      ['type-jeu', 1],
    ])
  })
})
