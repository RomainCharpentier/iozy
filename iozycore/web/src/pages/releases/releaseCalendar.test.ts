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

describe('the watched month', () => {
  it('comes from the URL when it is readable, from the device otherwise', () => {
    const aujourdHui = new Date(2026, 8, 9)
    expect(moisDepuisParametre('2026-10', aujourdHui)).toBe('2026-10')
    expect(moisDepuisParametre(null, aujourdHui)).toBe('2026-09')
    expect(moisDepuisParametre('octobre', aujourdHui)).toBe('2026-09')
    expect(moisDepuisParametre('2026-13', aujourdHui)).toBe('2026-09')
  })

  it('has its bounds included, February included, and turns in both directions', () => {
    expect(bornesDuMois('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(bornesDuMois('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(moisSuivant('2026-12')).toBe('2027-01')
    expect(moisPrecedent('2026-01')).toBe('2025-12')
  })
})

describe('grilleDuMois', () => {
  it('starts on Monday, completes the weeks with the neighbouring months, and stops at the last one', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
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

  it('fits in four full weeks when the month allows it, six when it overflows', () => {
    // February 2027: 28 days, from Monday the 1st to Sunday the 28th.
    const court = grilleDuMois('2027-02')
    expect(court).toHaveLength(4)
    expect(court[0][0].iso).toBe('2027-02-01')
    expect(court.flat().some((c) => c.horsMois)).toBe(false)

    // January 2000 starts on a Saturday: five days of December in front, six rows.
    const long = grilleDuMois('2000-01')
    expect(long).toHaveLength(6)
    expect(long[0][0].iso).toBe('1999-12-27')
    expect(long[5][6].iso).toBe('2000-02-06')
  })
})

describe('rangerParJour', () => {
  it('groups by day in the received order, and sets apart what has no day', () => {
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

  it('counts the releases by category', () => {
    const comptes = compterParCategorie([sortie('2026-10-02'), sortie('2026-10-03'), sortie('2026-10-03', 'DAY', 'type-jeu')])

    expect([...comptes.entries()]).toEqual([
      ['type-manga', 2],
      ['type-jeu', 1],
    ])
  })

  it('tells two volumes of the same work apart by their key', () => {
    const base = sortie('2026-10-02')
    expect(cleDeSortie(base)).not.toBe(cleDeSortie({ ...base, label: 'Tome 73 · Kana' }))
    expect(cleDeSortie(base)).toBe(cleDeSortie({ ...base }))
  })
})

describe('grouperParMois', () => {
  it('lays out in calendar order, month by month, the dates to be specified at the end of the month', () => {
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
