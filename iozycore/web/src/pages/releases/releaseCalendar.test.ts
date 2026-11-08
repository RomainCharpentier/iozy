import { describe, expect, it } from 'vitest'
import { cleDeSortie, compteARebours, compterParCategorie, estManquante, grouperParMois, joursAvant, prochaineSortie } from './releaseCalendar'
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

describe('the categories and the keys', () => {
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

describe('prochaineSortie', () => {
  it('counts down to the first release known to the day, from today on', () => {
    const passee = sortie('2026-11-02')
    const aPreciser = sortie('2026-11', 'MONTH')
    const vendredi = sortie('2026-11-13')
    const decembre = sortie('2026-12-04')

    expect(prochaineSortie([decembre, aPreciser, vendredi, passee], '2026-11-08')).toBe(vendredi)
    expect(prochaineSortie([decembre, vendredi], '2026-11-13')).toBe(vendredi)
  })

  it('falls back on a release known to the month only when nothing is dated to the day', () => {
    const aPreciser = sortie('2026-11', 'MONTH')
    expect(prochaineSortie([aPreciser, sortie('2026-11-02')], '2026-11-08')).toBe(aPreciser)
    expect(prochaineSortie([sortie('2026-10', 'MONTH')], '2026-11-08')).toBeNull()
    expect(prochaineSortie([], '2026-11-08')).toBeNull()
  })
})

describe('joursAvant', () => {
  it('counts whole days, across a month and a change of hour', () => {
    expect(joursAvant('2026-11-08', '2026-11-08')).toBe(0)
    expect(joursAvant('2026-11-09', '2026-11-08')).toBe(1)
    expect(joursAvant('2026-12-04', '2026-11-08')).toBe(26)
    expect(joursAvant('2026-03-30', '2026-03-28')).toBe(2)
  })
})

describe('estManquante', () => {
  it('is what the collection does not have yet: missing or wished, never owned', () => {
    expect(estManquante({ relation: 'MISSING' })).toBe(true)
    expect(estManquante({ relation: 'WANTED' })).toBe(true)
    expect(estManquante({ relation: 'OWNED' })).toBe(false)
  })
})

describe('compteARebours', () => {
  it('writes the days left, tomorrow and today in words, and a month when the day is unknown', () => {
    expect(compteARebours(sortie('2026-11-13'), '2026-11-08')).toEqual({ nombre: '5', mot: 'jours' })
    expect(compteARebours(sortie('2026-11-09'), '2026-11-08')).toEqual({ nombre: 'Demain', mot: '' })
    expect(compteARebours(sortie('2026-11-08'), '2026-11-08')).toEqual({ nombre: "Aujourd'hui", mot: '' })
    expect(compteARebours(sortie('2026-12', 'MONTH'), '2026-11-08')).toEqual({ nombre: 'Décembre 2026', mot: 'date à préciser' })
  })
})
