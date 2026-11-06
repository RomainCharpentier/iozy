/**
 * Tests de la conversion des points de départ (secondes ↔ « mm:ss »)
 */
import {
  fitStartToDuration,
  pickPlayableStart,
  randomStartFraction,
  START_TIME_MAX,
  formatTimecode,
  getQuestionStartTime,
  isValidStartTime,
  normalizeStartTime,
  parseTimecode,
} from '@/utils/timecode'
import { questionSchema } from '@/schemas/questionSchema'

describe('parseTimecode', () => {
  it('accepte un nombre de secondes', () => {
    expect(parseTimecode('0')).toBe(0)
    expect(parseTimecode('90')).toBe(90)
    expect(parseTimecode(' 125 ')).toBe(125)
  })

  it('accepte mm:ss et m:ss', () => {
    expect(parseTimecode('1:30')).toBe(90)
    expect(parseTimecode('01:30')).toBe(90)
    expect(parseTimecode('0:05')).toBe(5)
    expect(parseTimecode('12:00')).toBe(720)
    // Minutes au-delà de 59 sans heures : toléré
    expect(parseTimecode('75:00')).toBe(4500)
  })

  it('accepte h:mm:ss', () => {
    expect(parseTimecode('1:02:03')).toBe(3723)
  })

  it('une saisie vide vaut 0', () => {
    expect(parseTimecode('')).toBe(0)
    expect(parseTimecode('   ')).toBe(0)
  })

  it('refuse les saisies invalides', () => {
    for (const value of [
      'abc',
      '1:60',
      '1:2:3:4',
      '-5',
      '1.5',
      '1:',
      ':30',
      '1:02:60',
      '1:60:00',
    ]) {
      expect(parseTimecode(value)).toBeNull()
    }
  })

  it('refuse les valeurs au-delà de la borne haute', () => {
    expect(parseTimecode(String(START_TIME_MAX))).toBe(START_TIME_MAX)
    expect(parseTimecode(String(START_TIME_MAX + 1))).toBeNull()
  })
})

describe('formatTimecode', () => {
  it('formate en m:ss', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(5)).toBe('0:05')
    expect(formatTimecode(90)).toBe('1:30')
    expect(formatTimecode(720)).toBe('12:00')
  })

  it("formate en h:mm:ss au-delà d'une heure", () => {
    expect(formatTimecode(3723)).toBe('1:02:03')
  })

  it('aller-retour secondes → texte → secondes', () => {
    for (const seconds of [0, 1, 59, 60, 61, 599, 3599, 3600, 3723, START_TIME_MAX]) {
      expect(parseTimecode(formatTimecode(seconds))).toBe(seconds)
    }
  })

  it('aller-retour texte → secondes → texte', () => {
    expect(formatTimecode(parseTimecode('01:30') as number)).toBe('1:30')
  })
})

describe('isValidStartTime / normalizeStartTime', () => {
  it('valide les entiers dans les bornes', () => {
    expect(isValidStartTime(0)).toBe(true)
    expect(isValidStartTime(42)).toBe(true)
    expect(isValidStartTime(-1)).toBe(false)
    expect(isValidStartTime(1.5)).toBe(false)
    expect(isValidStartTime('42')).toBe(false)
    expect(isValidStartTime(undefined)).toBe(false)
  })

  it('normalise toute valeur invalide à 0', () => {
    expect(normalizeStartTime(42)).toBe(42)
    expect(normalizeStartTime(42.9)).toBe(42)
    expect(normalizeStartTime(-3)).toBe(0)
    expect(normalizeStartTime(NaN)).toBe(0)
    expect(normalizeStartTime('12')).toBe(0)
    expect(normalizeStartTime(undefined)).toBe(0)
    expect(normalizeStartTime(START_TIME_MAX + 1)).toBe(0)
  })
})

describe('getQuestionStartTime', () => {
  it('utilise startTime en priorité', () => {
    expect(getQuestionStartTime({ startTime: 30, mediaUrl: 'https://youtu.be/abc?t=90' })).toBe(30)
    expect(getQuestionStartTime({ startTime: 0, mediaUrl: 'https://youtu.be/abc?t=90' })).toBe(0)
  })

  it("se rabat sur le t= de l'URL YouTube, sinon 0", () => {
    expect(getQuestionStartTime({ mediaUrl: 'https://youtu.be/abc?t=90' })).toBe(90)
    expect(getQuestionStartTime({ mediaUrl: 'https://youtu.be/abc' })).toBe(0)
    expect(getQuestionStartTime({ mediaUrl: '/media/song.mp3' })).toBe(0)
  })

  it('ignore un startTime invalide', () => {
    expect(getQuestionStartTime({ startTime: -4, mediaUrl: 'https://youtu.be/abc' })).toBe(0)
  })
})

describe('questionSchema.startTime', () => {
  const base = {
    mediaUrl: 'https://www.youtube.com/watch?v=abc',
    answer: 'Réponse',
    categories: ['films'],
  }

  it('accepte vide, mm:ss et secondes', () => {
    for (const startTime of [undefined, '', '1:30', '90']) {
      expect(questionSchema.safeParse({ ...base, startTime }).success).toBe(true)
    }
  })

  it('refuse un format invalide', () => {
    const result = questionSchema.safeParse({ ...base, startTime: '1:75' })
    expect(result.success).toBe(false)
  })
})

describe('fitStartToDuration', () => {
  it('garde le départ quand l’extrait tient jusqu’à la fin du chrono', () => {
    expect(fitStartToDuration(30, 300, 20)).toBe(30)
    expect(fitStartToDuration(280, 300, 20)).toBe(280)
  })

  it('avance un départ trop tardif à « durée − chrono »', () => {
    expect(fitStartToDuration(290, 300, 20)).toBe(280)
    expect(fitStartToDuration(299.5, 300.9, 20)).toBe(280)
  })

  it('média plus court que le chrono : départ au début', () => {
    expect(fitStartToDuration(10, 15, 20)).toBe(0)
  })

  it('durée inconnue (métadonnées non chargées) : départ inchangé', () => {
    expect(fitStartToDuration(290, undefined, 20)).toBe(290)
    expect(fitStartToDuration(290, NaN, 20)).toBe(290)
    expect(fitStartToDuration(290, 0, 20)).toBe(290)
  })
})

describe('pickPlayableStart (départ aléatoire)', () => {
  it('répartit la fraction entre le départ minimum et « durée − chrono »', () => {
    // Vidéo de 213 s, chrono 20 s : départs possibles 0..193
    expect(pickPlayableStart(0, 213, 20, 0)).toBe(0)
    expect(pickPlayableStart(0, 213, 20, 0.5)).toBe(97)
    expect(pickPlayableStart(0, 213, 20, 0.9999)).toBe(193)
    // Départ minimum de l'éditeur respecté
    expect(pickPlayableStart(60, 213, 20, 0)).toBe(60)
    expect(pickPlayableStart(60, 213, 20, 0.9999)).toBe(193)
  })

  it('même fraction, même durée → même départ pour tous les joueurs', () => {
    expect(pickPlayableStart(0, 282, 20, 0.4242)).toBe(pickPlayableStart(0, 282, 20, 0.4242))
  })

  it('vidéo plus courte que le chrono : départ au début (elle boucle ensuite)', () => {
    expect(pickPlayableStart(0, 18, 20, 0.8)).toBe(0)
    expect(pickPlayableStart(5, 18, 20, 0.8)).toBe(0)
  })

  it('durée inconnue : départ minimum', () => {
    expect(pickPlayableStart(30, undefined, 20, 0.8)).toBe(30)
  })

  it('randomStartFraction reste dans [0, 1)', () => {
    expect(randomStartFraction(() => 0)).toBe(0)
    expect(randomStartFraction(() => 0.99999999)).toBeLessThan(1)
  })
})
