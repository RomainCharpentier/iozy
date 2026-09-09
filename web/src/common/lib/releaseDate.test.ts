import { describe, expect, it } from 'vitest'
import {
  formatReleaseDate,
  isoLocal,
  libelleDateCourte,
  libelleJour,
  libelleMois,
  parseReleaseDate,
  periodeAVenir,
  phraseDeCouverture,
  yearMonthLocal,
} from './releaseDate'
import { typeDeCollection } from '@/test/fixtures'

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
    expect(libelleMois('2026-10')).toBe('Octobre 2026')
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
})

describe('phraseDeCouverture', () => {
  it('dit ce que chaque catégorie apporte, d’après le type lui-même', () => {
    const manga = { ...typeDeCollection('MANGA', 'Manga'), hasReleaseSource: true }
    const jeu = { ...typeDeCollection('VIDEO_GAME', 'Jeu vidéo'), hasReleaseSource: true }
    const societe = typeDeCollection('BOARD_GAME', 'Jeu de société')

    expect(phraseDeCouverture([manga, jeu, societe])).toBe(
      'Les dates de Manga et Jeu vidéo viennent de leurs sources, pour ce que tu possèdes ou veux. ' +
        'Pour Jeu de société, renseigne « Date de sortie » sur la fiche d\'une œuvre.',
    )
    expect(phraseDeCouverture([societe])).toBe('Pour Jeu de société, renseigne « Date de sortie » sur la fiche d\'une œuvre.')
    expect(phraseDeCouverture([])).toBe('')
  })
})
