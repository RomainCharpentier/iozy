import { describe, expect, it } from 'vitest'
import {
  JOURS_DE_LA_SEMAINE_COURTS,
  formatReleaseDate,
  isoLocal,
  libelleDateCourte,
  libelleJour,
  libelleMois,
  parseReleaseDate,
  periodeAVenir,
  periodeSurUnAn,
  titreDuJour,
  yearMonthLocal,
} from './releaseDate'

describe('parseReleaseDate', () => {
  it('lit un jour et un mois, et refuse le reste', () => {
    expect(parseReleaseDate('2026-10-14')).toEqual({ iso: '2026-10-14', precision: 'DAY', year: 2026, month: 10, day: 14 })
    expect(parseReleaseDate(' 2026-10 ')).toEqual({ iso: '2026-10', precision: 'MONTH', year: 2026, month: 10, day: null })
    for (const valeur of ['2026', 'DL 2009', '2026-13', '2026-02-30', 2026, null, undefined, '']) {
      expect(parseReleaseDate(valeur), String(valeur)).toBeNull()
    }
  })
})

describe('les libellés en français', () => {
  it('écrit une date au jour ou au mois, sans glisser d’un jour selon le fuseau', () => {
    expect(formatReleaseDate('2026-10-14')).toBe('14 octobre 2026')
    expect(formatReleaseDate('2026-10')).toBe('octobre 2026')
    expect(formatReleaseDate('2026')).toBeNull()
    expect(libelleDateCourte('2026-10-14')).toBe('14 oct.')
    expect(libelleDateCourte('2026-10')).toBe('oct. 2026')
    expect(libelleJour('2026-10-14')).toBe('mercredi 14 octobre')
    expect(titreDuJour('2026-10-14')).toBe('Mercredi 14 octobre')
    expect(libelleMois('2026-10')).toBe('Octobre 2026')
  })

  it('nomme les colonnes de la semaine, lundi en tête', () => {
    expect(JOURS_DE_LA_SEMAINE_COURTS).toEqual(['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'])
  })

  it('date l’appareil en heure locale, pas en UTC', () => {
    const tardLeSoir = new Date(2026, 8, 30, 23, 30)
    expect(isoLocal(tardLeSoir)).toBe('2026-09-30')
    expect(yearMonthLocal(tardLeSoir)).toBe('2026-09')
  })

  it('ouvre la fenêtre de l’aperçu d’aujourd’hui à dans trois mois, jour pour jour', () => {
    expect(periodeAVenir(new Date(2026, 8, 9))).toEqual({ from: '2026-09-09', to: '2026-12-09' })
    expect(periodeAVenir(new Date(2026, 10, 30))).toEqual({ from: '2026-11-30', to: '2027-03-02' })
  })

  it('ouvre la fenêtre de ce qui vient sur un an moins un jour, bissextile compris', () => {
    expect(periodeSurUnAn(new Date(2026, 8, 10))).toEqual({ from: '2026-09-10', to: '2027-09-09' })
    expect(periodeSurUnAn(new Date(2028, 1, 29))).toEqual({ from: '2028-02-29', to: '2029-02-28' })
  })
})
