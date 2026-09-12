import { describe, expect, it } from 'vitest'
import {
  bornesDuMois,
  cleDeSortie,
  compterParCategorie,
  grilleDuMois,
  grouperParMois,
  moisDepuisParametre,
  moisPrecedent,
  moisSuivant,
  rangerParJour,
} from './releaseCalendar'
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

describe('grilleDuMois', () => {
  it('commence le lundi, complète les semaines avec les mois voisins, et s’arrête à la dernière', () => {
    // Septembre 2026 commence un mardi et finit un mercredi.
    const semaines = grilleDuMois('2026-09')

    expect(semaines).toHaveLength(5)
    expect(semaines[0].map((c) => c.iso)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
    expect(semaines[0][0]).toEqual({ iso: '2026-08-31', jour: 31, horsMois: true })
    expect(semaines[0][1]).toEqual({ iso: '2026-09-01', jour: 1, horsMois: false })
    expect(semaines[4][6]).toEqual({ iso: '2026-10-04', jour: 4, horsMois: true })
    expect(semaines.flat().filter((c) => !c.horsMois)).toHaveLength(30)
  })

  it('tient en quatre semaines pleines quand le mois s’y prête, six quand il déborde', () => {
    // Février 2027 : 28 jours, du lundi 1er au dimanche 28.
    const court = grilleDuMois('2027-02')
    expect(court).toHaveLength(4)
    expect(court[0][0].iso).toBe('2027-02-01')
    expect(court.flat().some((c) => c.horsMois)).toBe(false)

    // Janvier 2000 commence un samedi : cinq jours de décembre devant, six lignes.
    const long = grilleDuMois('2000-01')
    expect(long).toHaveLength(6)
    expect(long[0][0].iso).toBe('1999-12-27')
    expect(long[5][6].iso).toBe('2000-02-06')
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

  it('distingue deux tomes d’une même œuvre par leur clé', () => {
    const base = sortie('2026-10-02')
    expect(cleDeSortie(base)).not.toBe(cleDeSortie({ ...base, label: 'Tome 73 · Kana' }))
    expect(cleDeSortie(base)).toBe(cleDeSortie({ ...base }))
  })
})

describe('grouperParMois', () => {
  it('range dans l’ordre du calendrier, mois par mois, les dates à préciser en fin de mois', () => {
    const mars = sortie('2026-03-19')
    const fevrierAPreciser = sortie('2026-02', 'MONTH')
    const fevrier = sortie('2026-02-03')
    const groupes = grouperParMois([mars, fevrierAPreciser, fevrier])

    expect(groupes.map((g) => g.mois)).toEqual(['2026-02', '2026-03'])
    expect(groupes[0].entries).toEqual([fevrier, fevrierAPreciser])
    expect(groupes[1].entries).toEqual([mars])
    expect(grouperParMois([])).toEqual([])
  })
})
