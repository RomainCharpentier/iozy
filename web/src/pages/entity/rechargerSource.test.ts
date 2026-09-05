/**
 * <b>Le seul endroit de l'app qui peut ÉCRASER des données de l'utilisateur.</b>
 *
 * « Recharger depuis la source » redemande à un fournisseur ce qu'il sait
 * d'une œuvre déjà en collection, puis réécrit ses attributs. Deux erreurs y
 * seraient invisibles et irrattrapables :
 * <ul>
 *   <li><b>se tromper d'œuvre</b> : un « à peu près » sur le titre recopierait
 *       tranquillement les informations d'un spin-off sur la série mère ;</li>
 *   <li><b>écraser ce que l'utilisateur a choisi</b> : sa remarque, et surtout
 *       la jaquette qu'il a posée à la main - la seule donnée d'origine externe
 *       qu'il édite couramment.</li>
 * </ul>
 *
 * <p>Et une troisième, plus discrète : réécrire une valeur identique. Le
 * décompte rendu à l'écran doit pouvoir dire « tout est déjà à jour » sans
 * mentir.
 */
import { describe, expect, it } from 'vitest'
import { attributsARecharger, candidatCorrespondant } from './rechargerSource'
import type { MetadataCandidateDto } from '@/common/types/api'

function candidat(title: string, attributes: Record<string, unknown> = {}, imageUrl: string | null = null): MetadataCandidateDto {
  return { source: 'JIKAN', externalId: String(attributes.malId ?? title), title, imageUrl, attributes }
}

describe('reconnaître l’œuvre parmi les candidats', () => {
  it('se fie d’abord à l’identifiant du fournisseur', () => {
    const candidats = [candidat('Naruto Gaiden', { malId: '99' }), candidat('Naruto', { malId: '11' })]

    const trouve = candidatCorrespondant(candidats, { title: 'Un titre saisi à la main', attributes: { malId: '11' } })

    expect(trouve?.title).toBe('Naruto')
  })

  it('reconnaît l’identifiant porté par l’externalId du candidat', () => {
    const candidats = [candidat('Naruto', {}, null)]

    expect(candidatCorrespondant(candidats, { title: 'Autre chose', attributes: { malId: 'Naruto' } })?.title)
      .toBe('Naruto')
  })

  it('à défaut d’identifiant, accepte le titre exact aux accents et à la casse près', () => {
    const candidats = [candidat('Bleach'), candidat("L'Attaque des Titans"), candidat('Ōoku')]

    expect(candidatCorrespondant(candidats, { title: "l'attaque des titans", attributes: {} })?.title)
      .toBe("L'Attaque des Titans")
    expect(candidatCorrespondant(candidats, { title: 'Ooku', attributes: {} })?.title).toBe('Ōoku')
  })

  it('ne va pas jusqu’à ignorer la ponctuation', () => {
    // La tolérance s'arrête aux accents, à la casse et aux espaces : plus
    // large, elle finirait par rapprocher deux titres réellement différents.
    const candidats = [candidat("L'Attaque des Titans")]

    expect(candidatCorrespondant(candidats, { title: 'l attaque des titans', attributes: {} })).toBeNull()
  })

  it('refuse un « à peu près » plutôt que de recopier un dérivé', () => {
    // « Naruto Shippuden » n'est pas « Naruto » : mieux vaut ne rien recharger
    // que de remplir une fiche avec les informations d'une autre série.
    const candidats = [candidat('Naruto Shippuden'), candidat('Naruto Gaiden')]

    expect(candidatCorrespondant(candidats, { title: 'Naruto', attributes: {} })).toBeNull()
  })

  it('ne trouve rien dans une liste vide, sans lever', () => {
    expect(candidatCorrespondant([], { title: 'Naruto', attributes: { malId: '11' } })).toBeNull()
  })
})

describe('décider ce qu’il faut écrire', () => {
  const oeuvre = {
    title: 'Naruto',
    attributes: { mangaka: 'Masashi Kishimoto', totalVolumes: 70, note: 'offert par Paul' },
  }

  it('n’écrit que ce qui change vraiment', () => {
    const source = candidat('Naruto', { mangaka: 'Masashi Kishimoto', totalVolumes: 72, seriesStatus: 'Finished' })

    expect(attributsARecharger(source, oeuvre)).toEqual({ totalVolumes: 72, seriesStatus: 'Finished' })
  })

  it('n’écrit rien du tout quand la source ne sait rien de neuf', () => {
    const source = candidat('Naruto', { mangaka: 'Masashi Kishimoto', totalVolumes: 70 })

    expect(attributsARecharger(source, oeuvre)).toEqual({})
  })

  it('ne touche jamais à un champ saisi à la main - même si la source le contredit', () => {
    const source = candidat('Naruto', { mangaka: 'Kishimoto', totalVolumes: 72 })
    const saisie = { ...oeuvre, champsSaisis: ['mangaka'] }

    expect(attributsARecharger(source, saisie)).toEqual({ totalVolumes: 72 })
  })

  it('ne touche jamais à la remarque de l’utilisateur', () => {
    // Elle ne vient d'aucune source ; le sac d'attributs mélange les deux.
    const source = candidat('Naruto', { note: 'Manga shonen des années 2000' })

    expect(attributsARecharger(source, oeuvre)).not.toHaveProperty('note')
  })

  it('ignore une valeur vide de la source plutôt que d’effacer la nôtre', () => {
    const source = candidat('Naruto', { mangaka: '', totalVolumes: null, seriesStatus: undefined })

    expect(attributsARecharger(source, oeuvre)).toEqual({})
  })
})

describe('la jaquette, cas à part', () => {
  it('ne défait pas une jaquette choisie à la main', () => {
    const source = candidat('Naruto', {}, 'https://source/naruto.jpg')
    const avecJaquette = { title: 'Naruto', attributes: { coverImageUrl: 'https://choisie/par/moi.jpg' } }

    expect(attributsARecharger(source, avecJaquette)).toEqual({})
  })

  it('la pose quand elle manque - c’est tout l’intérêt du bouton', () => {
    const source = candidat('Naruto', {}, 'https://source/naruto.jpg')

    expect(attributsARecharger(source, { title: 'Naruto', attributes: {} }))
      .toEqual({ coverImageUrl: 'https://source/naruto.jpg' })
  })

  it('ignore la jaquette portée par les attributs de la source, jamais recopiée telle quelle', () => {
    const source = candidat('Naruto', { coverImageUrl: 'https://source/attribut.jpg' }, null)

    expect(attributsARecharger(source, { title: 'Naruto', attributes: {} })).toEqual({})
  })
})
