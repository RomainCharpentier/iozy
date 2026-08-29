/**
 * <b>Quel titre est écrit, et quel titre n'est qu'affiché.</b>
 *
 * La composition décide de deux choses différentes, et les confondre écrirait
 * en base une chaîne à parenthèses : `resolvePrimaryTitle` donne le titre
 * réellement SAISI, `candidateDisplayTitle` la forme lue à l'écran. La règle
 * commune : la première langue <b>active</b> dont la valeur est disponible pour
 * ce candidat l'emporte - l'ordre choisi compte, mais une langue activée sans
 * valeur ne bloque pas la suivante.
 *
 * <p>La composition vient du `localStorage` : une valeur écrite par une
 * version précédente, ou éditée à la main, ne doit pas faire afficher des
 * titres vides.
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
import type { MetadataCandidateDto } from '../types/api'

const CLE = 'iozycore.titleComposition'

/** Le cas normal d'un candidat Jikan : romaji toujours là, anglais parfois. */
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
  it('retient la première langue active dont la valeur existe', () => {
    expect(resolvePrimaryTitle(candidat(), FRANCAIS_PUIS_ROMAJI, "L'Attaque des Titans"))
      .toBe("L'Attaque des Titans")
  })

  it('passe à la suivante quand la langue en tête n’a rien à offrir', () => {
    // Le français est best-effort : la recherche peut n'avoir rien trouvé.
    expect(resolvePrimaryTitle(candidat(), FRANCAIS_PUIS_ROMAJI, undefined)).toBe('Shingeki no Kyojin')
  })

  it('respecte l’ordre choisi, pas un ordre par défaut', () => {
    const romajiDAbord = composition(['ROMAJI', true], ['FRENCH', true], ['ENGLISH', false])

    expect(resolvePrimaryTitle(candidat(), romajiDAbord, "L'Attaque des Titans")).toBe('Shingeki no Kyojin')
  })

  it('ignore une langue désactivée, même en tête et disponible', () => {
    const francaisEteint = composition(['FRENCH', false], ['ENGLISH', true], ['ROMAJI', true])

    expect(resolvePrimaryTitle(candidat(), francaisEteint, "L'Attaque des Titans")).toBe('Attack on Titan')
  })

  it('retombe sur le titre de la source si tout est éteint', () => {
    const toutEteint = composition(['FRENCH', false], ['ENGLISH', false], ['ROMAJI', false])

    expect(resolvePrimaryTitle(candidat(), toutEteint, "L'Attaque des Titans")).toBe('Shingeki no Kyojin')
  })
})

describe('candidateDisplayTitle', () => {
  it('met les langues actives suivantes entre parenthèses, dans l’ordre', () => {
    const lesTrois = composition(['FRENCH', true], ['ROMAJI', true], ['ENGLISH', true])

    expect(candidateDisplayTitle(candidat(), lesTrois, "L'Attaque des Titans"))
      .toBe("L'Attaque des Titans (Shingeki no Kyojin, Attack on Titan)")
  })

  it('ne répète pas entre parenthèses un titre identique au principal', () => {
    // Romaji et anglais valent parfois la même chaîne : « X (X) » ne dit rien.
    const romajiEtAnglais = composition(['ROMAJI', true], ['ENGLISH', true], ['FRENCH', false])
    const memeTitre = candidat({ titleEnglish: 'Shingeki no Kyojin' })

    expect(candidateDisplayTitle(memeTitre, romajiEtAnglais, undefined)).toBe('Shingeki no Kyojin')
  })

  it('sans seconde langue disponible, n’ouvre pas de parenthèse vide', () => {
    expect(candidateDisplayTitle(candidat({ titleEnglish: undefined }), FRANCAIS_PUIS_ROMAJI, undefined))
      .toBe('Shingeki no Kyojin')
  })
})

describe('la composition mémorisée', () => {
  it('se relit telle qu’elle a été enregistrée', () => {
    const choisie = composition(['ENGLISH', true], ['FRENCH', true], ['ROMAJI', false])

    setTitleComposition(choisie)

    expect(getTitleComposition()).toEqual(choisie)
  })

  it('retombe sur le défaut devant une composition incomplète ou inconnue', () => {
    localStorage.setItem(CLE, JSON.stringify([{ language: 'FRENCH', enabled: true }]))
    expect(getTitleComposition()).toEqual(FRANCAIS_PUIS_ROMAJI)

    localStorage.setItem(CLE, JSON.stringify([{ language: 'FRENCH', enabled: true }, { language: 'KLINGON', enabled: true }, { language: 'ROMAJI', enabled: true }]))
    expect(getTitleComposition()).toEqual(FRANCAIS_PUIS_ROMAJI)

    localStorage.setItem(CLE, 'pas du json')
    expect(getTitleComposition()).toEqual(FRANCAIS_PUIS_ROMAJI)
  })

  it('dit si le français est actif - ce qui déclenche la recherche best-effort', () => {
    expect(isFrenchEnabled(FRANCAIS_PUIS_ROMAJI)).toBe(true)
    expect(isFrenchEnabled(composition(['FRENCH', false], ['ROMAJI', true], ['ENGLISH', true]))).toBe(false)
  })
})
