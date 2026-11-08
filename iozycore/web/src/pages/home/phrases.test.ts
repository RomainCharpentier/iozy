/**
 * <b>The sentences of "ta semaine".</b> Each one promises something about the
 * collection: a day, a count, a total. These tests keep the promises true - a
 * total nobody knows is never written, a wish is never called an addition.
 */
import { describe, expect, it } from 'vitest'
import type { HomeLeadDto, HomeWorkDto } from '@/common/types/home'
import {
  contenuDuRayon,
  legendeDuChiffre,
  ligneAussi,
  ouTuEnEs,
  pourquoiLaUne,
  quandCetteSemaine,
  surtitreDeLaUne,
  titreDeSortie,
  titrePresqueFini,
} from './phrases'

/** Wednesday 11 November 2026, in the morning. */
const MERCREDI = new Date(2026, 10, 11, 10, 0)

function oeuvre(champs: Partial<HomeWorkDto> = {}): HomeWorkDto {
  return {
    entityId: 'w1',
    entityTypeId: 't1',
    title: 'Vinland Saga',
    coverImageUrl: null,
    collectorStatus: 'ONGOING',
    ownedCount: 8,
    totalCount: 15,
    missingCount: 6,
    wishedCount: 0,
    lastMovedAt: '2026-11-08T10:00:00Z',
    ...champs,
  }
}

describe('the day of a release this week', () => {
  it('says today, tomorrow, yesterday, or the weekday', () => {
    expect(quandCetteSemaine('2026-11-11', MERCREDI)).toBe("aujourd'hui")
    expect(quandCetteSemaine('2026-11-12', MERCREDI)).toBe('demain')
    expect(quandCetteSemaine('2026-11-10', MERCREDI)).toBe('hier')
    expect(quandCetteSemaine('2026-11-13', MERCREDI)).toBe('vendredi')
    expect(quandCetteSemaine('2026-11-09', MERCREDI)).toBe('lundi')
  })

  it('names what comes out, or the work alone when it is the work itself', () => {
    const release = { date: '2026-11-13', precision: 'DAY' as const, label: 'Tome 15', number: 15 }
    expect(titreDeSortie(oeuvre(), release, MERCREDI)).toBe('Vinland Saga, Tome 15 : sortie vendredi.')
    expect(titreDeSortie(oeuvre({ title: 'Totoro' }), { ...release, label: '' }, MERCREDI)).toBe(
      'Totoro : sortie vendredi.',
    )
  })
})

describe('where the collector stands', () => {
  it('never writes a total nobody knows', () => {
    expect(ouTuEnEs(oeuvre())).toBe('Tu en as 8 sur 15.')
    expect(ouTuEnEs(oeuvre({ totalCount: null, ownedCount: 3 }))).toBe('Tu en as 3.')
  })

  it('says a single piece is in the collection, and a work with no copy is a wish', () => {
    expect(ouTuEnEs(oeuvre({ ownedCount: 1, totalCount: 1 }))).toBe('Dans ta collection.')
    expect(ouTuEnEs(oeuvre({ ownedCount: 0, wishedCount: 1 }))).toBe('Dans tes envies.')
  })
})

describe('the lead', () => {
  const sortie: HomeLeadDto = {
    work: oeuvre(),
    reason: 'RELEASE',
    release: { date: '2026-11-13', precision: 'DAY', label: 'Tome 15', number: 15 },
    nextRelease: { date: '2026-11-13', precision: 'DAY', label: 'Tome 15', number: 15 },
    elements: [],
  }

  it('dates its kicker only for a release', () => {
    expect(surtitreDeLaUne(sortie)).toBe('À la une · vendredi 13 novembre')
    expect(surtitreDeLaUne({ ...sortie, reason: 'MOVED', release: null })).toBe('À la une')
  })

  it('does not repeat the release of the week as the next one', () => {
    expect(pourquoiLaUne(sortie, MERCREDI)).toBe("Tu en as 8 sur 15. Il t'en manque 6.")
  })

  it('says when the work that moved last moved, and its next release', () => {
    const bouge: HomeLeadDto = {
      ...sortie,
      reason: 'MOVED',
      release: null,
      work: oeuvre({ missingCount: 0, lastMovedAt: '2026-11-08T06:00:00Z' }),
      nextRelease: { date: '2026-12', precision: 'MONTH', label: 'Tome 16', number: 16 },
    }
    expect(pourquoiLaUne(bouge, MERCREDI)).toBe(
      'Ta dernière nouveauté, il y a 3 jours. Tu en as 8 sur 15. Prochaine sortie : Tome 16, décembre 2026.',
    )
  })
})

describe('also this week', () => {
  it('never calls a wish an addition to the shelves', () => {
    const envie = { work: oeuvre({ ownedCount: 0, wishedCount: 1, lastMovedAt: '2026-11-10T09:00:00Z' }), reason: 'MOVED' as const, release: null }
    expect(ligneAussi(envie, MERCREDI)).toEqual({ titre: 'Vinland Saga', detail: 'Ajouté à tes envies hier.' })
  })

  it('dates a move of an owned work without saying what moved', () => {
    const bouge = { work: oeuvre({ lastMovedAt: '2026-11-09T09:00:00Z' }), reason: 'MOVED' as const, release: null }
    expect(ligneAussi(bouge, MERCREDI).detail).toBe('Mis à jour lundi. Tu en as 8 sur 15.')
  })
})

describe('the number and the rest', () => {
  it('says this month and this week only when they hold something', () => {
    expect(legendeDuChiffre({ totalObjects: 45, addedThisMonth: 3, releasesThisWeek: 2 }, MERCREDI)).toEqual({
      libelle: 'objets dans ta collection.',
      details: ['+3 depuis le 1er novembre.', '2 sorties cette semaine.'],
    })
    expect(legendeDuChiffre({ totalObjects: 1, addedThisMonth: 0, releasesThisWeek: 0 }, MERCREDI)).toEqual({
      libelle: 'objet dans ta collection.',
      details: [],
    })
  })

  it('counts what is left of an almost done work in words', () => {
    expect(titrePresqueFini(oeuvre({ title: 'Frieren', missingCount: 1 }))).toBe("Frieren : il n'en manque plus qu'un.")
    expect(titrePresqueFini(oeuvre({ title: 'Catan', missingCount: 2 }))).toBe('Catan : plus que deux à trouver.')
  })

  it('counts a shelf in works and objects', () => {
    expect(contenuDuRayon(1, 2)).toBe('1 œuvre · 2 objets')
    expect(contenuDuRayon(4, 1)).toBe('4 œuvres · 1 objet')
  })
})
