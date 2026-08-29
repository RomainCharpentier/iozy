/**
 * <b>Les indices qu'on redonne à un fournisseur — et celui qu'on ne lui donne
 * jamais.</b>
 *
 * Ces attributs distinguent « Naruto » de ses huit dérivés quand on
 * réinterroge une source. Trois écrans les ré-extrayaient chacun à la main,
 * chacun un sous-ensemble différent : quatre pour la recherche de tomes, un
 * seul pour le rattrapage de jaquettes, trois pour le titre français. La même
 * question posée avec moins d'indices ne donne pas une réponse moins précise -
 * elle donne une réponse fausse.
 *
 * <p>Et une exclusion volontaire : le `studio` d'un jeu vidéo n'entre pas ici.
 * Les appelants interrogent des fournisseurs de manga ; un studio y serait un
 * indice <b>faux</b>, pas un indice en plus.
 */
import { describe, expect, it } from 'vitest'
import { indicesDe } from './indicesOeuvre'

describe('indicesDe', () => {
  it('rassemble les quatre indices d’une série de manga', () => {
    expect(indicesDe({ mangaka: 'Masashi Kishimoto', malId: '11', titleRomaji: 'Naruto' })).toEqual({
      author: 'Masashi Kishimoto',
      malId: '11',
      titleRomaji: 'Naruto',
      originalTitle: 'Naruto',
    })
  })

  it('n’emporte pas le studio d’un jeu vidéo comme auteur', () => {
    expect(indicesDe({ studio: 'Supergiant Games' }).author).toBeUndefined()
  })

  it('retombe sur le titre anglais quand le romaji manque', () => {
    // C'est le titre d'origine qui retrouve les éditions chez les
    // fournisseurs qui n'indexent pas le titre français.
    const indices = indicesDe({ titleEnglish: 'Attack on Titan' })

    expect(indices.titleRomaji).toBeUndefined()
    expect(indices.originalTitle).toBe('Attack on Titan')
  })

  it('préfère le romaji à l’anglais quand les deux existent', () => {
    expect(indicesDe({ titleRomaji: 'Shingeki no Kyojin', titleEnglish: 'Attack on Titan' }).originalTitle)
      .toBe('Shingeki no Kyojin')
  })

  it('ignore une chaîne vide ou blanche : un indice vide en est un faux', () => {
    expect(indicesDe({ mangaka: '   ', malId: '' })).toEqual({
      author: undefined,
      malId: undefined,
      titleRomaji: undefined,
      originalTitle: undefined,
    })
  })

  it('ne rend que des indices absents pour une œuvre saisie à la main', () => {
    expect(indicesDe(undefined).author).toBeUndefined()
    expect(indicesDe({}).originalTitle).toBeUndefined()
  })
})
