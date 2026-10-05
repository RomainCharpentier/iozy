/**
 * <b>Which title is written, and which title is only displayed.</b>
 *
 * The composition decides two different things, and confusing them would
 * write a string with parentheses to the database: `resolvePrimaryTitle`
 * gives the title actually ENTERED, `candidateDisplayTitle` the form read on
 * the screen. The common rule: the first <b>active</b> language whose value
 * is available for this candidate wins - the chosen order matters, but an
 * enabled language without a value does not block the next one.
 *
 * <p>The composition comes from `localStorage`: a value written by a
 * previous version, or edited by hand, must not make empty titles appear.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  candidateDisplayTitle,
  getTitleComposition,
  isFrenchEnabled,
  resolvePrimaryTitle,
  setTitleComposition,
  type TitleComposition,
} from './titleLanguage'
import type { MetadataCandidateDto } from '@/common/types/api'

const CLE = 'iozycore.titleComposition'

/** The normal case of a Jikan candidate: romaji always there, English sometimes. */
function candidat(attributes: Record<string, unknown> = {}): MetadataCandidateDto {
  return {
    source: 'JIKAN',
    externalId: 'mal-1',
    title: 'Shingeki no Kyojin',
    imageUrl: null,
    attributes: { titleRomaji: 'Shingeki no Kyojin', titleEnglish: 'Attack on Titan', ...attributes },
  }
}

function composition(...items: [string, boolean][]): TitleComposition {
  return items.map(([language, enabled]) => ({ language, enabled })) as TitleComposition
}

const FRANCAIS_PUIS_ROMAJI = composition(['FRENCH', true], ['ROMAJI', true], ['ENGLISH', false])

beforeEach(() => localStorage.clear())

describe('resolvePrimaryTitle', () => {
  it('keeps the first active language whose value exists', () => {
    expect(resolvePrimaryTitle(candidat(), FRANCAIS_PUIS_ROMAJI, "L'Attaque des Titans"))
      .toBe("L'Attaque des Titans")
  })

  it('moves to the next one when the language at the top has nothing to offer', () => {
    // French is best-effort: the search may have found nothing.
    expect(resolvePrimaryTitle(candidat(), FRANCAIS_PUIS_ROMAJI, undefined)).toBe('Shingeki no Kyojin')
  })

  it('respects the chosen order, not a default order', () => {
    const romajiDAbord = composition(['ROMAJI', true], ['FRENCH', true], ['ENGLISH', false])

    expect(resolvePrimaryTitle(candidat(), romajiDAbord, "L'Attaque des Titans")).toBe('Shingeki no Kyojin')
  })

  it('ignores a disabled language, even at the top and available', () => {
    const francaisEteint = composition(['FRENCH', false], ['ENGLISH', true], ['ROMAJI', true])

    expect(resolvePrimaryTitle(candidat(), francaisEteint, "L'Attaque des Titans")).toBe('Attack on Titan')
  })

  it('falls back on the title of the source if everything is off', () => {
    const toutEteint = composition(['FRENCH', false], ['ENGLISH', false], ['ROMAJI', false])

    expect(resolvePrimaryTitle(candidat(), toutEteint, "L'Attaque des Titans")).toBe('Shingeki no Kyojin')
  })
})

describe('candidateDisplayTitle', () => {
  it('puts the following active languages in parentheses, in order', () => {
    const lesTrois = composition(['FRENCH', true], ['ROMAJI', true], ['ENGLISH', true])

    expect(candidateDisplayTitle(candidat(), lesTrois, "L'Attaque des Titans"))
      .toBe("L'Attaque des Titans (Shingeki no Kyojin, Attack on Titan)")
  })

  it('does not repeat in parentheses a title identical to the main one', () => {
    // Romaji and English are sometimes the same string: "X (X)" says nothing.
    const romajiEtAnglais = composition(['ROMAJI', true], ['ENGLISH', true], ['FRENCH', false])
    const memeTitre = candidat({ titleEnglish: 'Shingeki no Kyojin' })

    expect(candidateDisplayTitle(memeTitre, romajiEtAnglais, undefined)).toBe('Shingeki no Kyojin')
  })

  it('without a second language available, does not open an empty parenthesis', () => {
    expect(candidateDisplayTitle(candidat({ titleEnglish: undefined }), FRANCAIS_PUIS_ROMAJI, undefined))
      .toBe('Shingeki no Kyojin')
  })
})

describe('the remembered composition', () => {
  it('is read back as it was saved', () => {
    const choisie = composition(['ENGLISH', true], ['FRENCH', true], ['ROMAJI', false])

    setTitleComposition(choisie)

    expect(getTitleComposition()).toEqual(choisie)
  })

  it('falls back on the default when faced with an incomplete or unknown composition', () => {
    localStorage.setItem(CLE, JSON.stringify([{ language: 'FRENCH', enabled: true }]))
    expect(getTitleComposition()).toEqual(FRANCAIS_PUIS_ROMAJI)

    localStorage.setItem(CLE, JSON.stringify([{ language: 'FRENCH', enabled: true }, { language: 'KLINGON', enabled: true }, { language: 'ROMAJI', enabled: true }]))
    expect(getTitleComposition()).toEqual(FRANCAIS_PUIS_ROMAJI)

    localStorage.setItem(CLE, 'pas du json')
    expect(getTitleComposition()).toEqual(FRANCAIS_PUIS_ROMAJI)
  })

  it('says whether French is active - which triggers the best-effort search', () => {
    expect(isFrenchEnabled(FRANCAIS_PUIS_ROMAJI)).toBe(true)
    expect(isFrenchEnabled(composition(['FRENCH', false], ['ROMAJI', true], ['ENGLISH', true]))).toBe(false)
  })
})
