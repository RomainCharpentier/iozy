/**
 * <b>The only place in the app that can OVERWRITE user data.</b>
 *
 * "Recharger depuis la source" asks a provider again what it knows
 * about a work already in the collection, then rewrites its attributes. Two mistakes there
 * would be invisible and unrecoverable:
 * <ul>
 *   <li><b>picking the wrong work</b>: an "approximately" match on the title would quietly copy
 *       the information of a spin-off onto the parent series;</li>
 *   <li><b>overwriting what the user chose</b>: their remark, and above all
 *       the cover they set by hand - the only piece of external-origin data
 *       they commonly edit.</li>
 * </ul>
 *
 * <p>And a third, more discreet one: rewriting an identical value. The
 * count shown on screen must be able to say "everything is already up to date" without
 * lying.
 */
import { describe, expect, it } from 'vitest'
import { attributsARecharger, candidatCorrespondant } from './rechargerSource'
import type { MetadataCandidateDto } from '@/common/types/api'

function candidat(title: string, attributes: Record<string, unknown> = {}, imageUrl: string | null = null): MetadataCandidateDto {
  return { source: 'JIKAN', externalId: String(attributes.malId ?? title), title, imageUrl, attributes }
}

describe('recognize the work among the candidates', () => {
  it('trusts the provider id first', () => {
    const candidats = [candidat('Naruto Gaiden', { malId: '99' }), candidat('Naruto', { malId: '11' })]

    const trouve = candidatCorrespondant(candidats, { title: 'Un titre saisi à la main', attributes: { malId: '11' } })

    expect(trouve?.title).toBe('Naruto')
  })

  it('recognizes the id carried by the externalId of the candidate', () => {
    const candidats = [candidat('Naruto', {}, null)]

    expect(candidatCorrespondant(candidats, { title: 'Autre chose', attributes: { malId: 'Naruto' } })?.title)
      .toBe('Naruto')
  })

  it('without an id, accepts the exact title ignoring accents and case', () => {
    const candidats = [candidat('Bleach'), candidat("L'Attaque des Titans"), candidat('Ōoku')]

    expect(candidatCorrespondant(candidats, { title: "l'attaque des titans", attributes: {} })?.title)
      .toBe("L'Attaque des Titans")
    expect(candidatCorrespondant(candidats, { title: 'Ooku', attributes: {} })?.title).toBe('Ōoku')
  })

  it('does not go as far as ignoring punctuation', () => {
    // The tolerance stops at accents, case and spaces: any
    // wider, it would end up matching two really different titles.
    const candidats = [candidat("L'Attaque des Titans")]

    expect(candidatCorrespondant(candidats, { title: 'l attaque des titans', attributes: {} })).toBeNull()
  })

  it('refuses an "approximately" match rather than copying a derivative', () => {
    // "Naruto Shippuden" is not "Naruto": better to reload nothing
    // than to fill a detail page with the information of another series.
    const candidats = [candidat('Naruto Shippuden'), candidat('Naruto Gaiden')]

    expect(candidatCorrespondant(candidats, { title: 'Naruto', attributes: {} })).toBeNull()
  })

  it('finds nothing in an empty list, without throwing', () => {
    expect(candidatCorrespondant([], { title: 'Naruto', attributes: { malId: '11' } })).toBeNull()
  })
})

describe('decide what must be written', () => {
  const oeuvre = {
    title: 'Naruto',
    attributes: { mangaka: 'Masashi Kishimoto', totalVolumes: 70, note: 'offert par Paul' },
  }

  it('only writes what really changes', () => {
    const source = candidat('Naruto', { mangaka: 'Masashi Kishimoto', totalVolumes: 72, seriesStatus: 'Finished' })

    expect(attributsARecharger(source, oeuvre)).toEqual({ totalVolumes: 72, seriesStatus: 'Finished' })
  })

  it('writes nothing at all when the source knows nothing new', () => {
    const source = candidat('Naruto', { mangaka: 'Masashi Kishimoto', totalVolumes: 70 })

    expect(attributsARecharger(source, oeuvre)).toEqual({})
  })

  it('never touches a field entered by hand - even if the source contradicts it', () => {
    const source = candidat('Naruto', { mangaka: 'Kishimoto', totalVolumes: 72 })
    const saisie = { ...oeuvre, champsSaisis: ['mangaka'] }

    expect(attributsARecharger(source, saisie)).toEqual({ totalVolumes: 72 })
  })

  it('never touches the remark of the user', () => {
    // It comes from no source; the attribute bag mixes both.
    const source = candidat('Naruto', { note: 'Manga shonen des années 2000' })

    expect(attributsARecharger(source, oeuvre)).not.toHaveProperty('note')
  })

  it('ignores an empty value of the source rather than erasing ours', () => {
    const source = candidat('Naruto', { mangaka: '', totalVolumes: null, seriesStatus: undefined })

    expect(attributsARecharger(source, oeuvre)).toEqual({})
  })
})

describe('the cover, a special case', () => {
  it('does not undo a cover chosen by hand', () => {
    const source = candidat('Naruto', {}, 'https://source/naruto.jpg')
    const avecJaquette = { title: 'Naruto', attributes: { coverImageUrl: 'https://choisie/par/moi.jpg' } }

    expect(attributsARecharger(source, avecJaquette)).toEqual({})
  })

  it('sets it when it is missing - this is the whole point of the button', () => {
    const source = candidat('Naruto', {}, 'https://source/naruto.jpg')

    expect(attributsARecharger(source, { title: 'Naruto', attributes: {} }))
      .toEqual({ coverImageUrl: 'https://source/naruto.jpg' })
  })

  it('ignores the cover carried by the attributes of the source, never copied as is', () => {
    const source = candidat('Naruto', { coverImageUrl: 'https://source/attribut.jpg' }, null)

    expect(attributsARecharger(source, { title: 'Naruto', attributes: {} })).toEqual({})
  })
})
