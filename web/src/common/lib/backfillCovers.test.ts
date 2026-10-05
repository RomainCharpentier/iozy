/**
 * <b>"Retrouver les jaquettes manquantes": at most two calls, and no
 * invented match.</b>
 *
 * This backfill hits an external provider that is subject to a quota (Google
 * Books). Three rules follow from it, and each one breaks without anything
 * saying so - at worst, the quota of the day goes up in smoke:
 * <ul>
 *   <li>nothing to search ⇒ <b>no call</b>;</li>
 *   <li>the second search, the one that forces the cache to refresh and costs
 *       a real call, only happens if the first one <b>is not enough</b>;</li>
 *   <li>a <b>silent</b> provider (quota exceeded) is not a provider that
 *       answers "I do not have this cover": only the first one changes what
 *       the user has to do - try again later.</li>
 * </ul>
 *
 * <p>And never a cover set at random: a volume that is absent from the result
 * stays without a cover, a wrong cover would be worse than no cover.
 */
import { describe, expect, it, vi } from 'vitest'
import { findBestCoverMatch, rattraperJaquettes, variantsMissingCover } from './backfillCovers'
import { oeuvre, tome } from '@/test/fixtures'
import type { VolumeCandidateDto } from '@/common/types/api'

function candidat(volumeNumber: number, edition: string, imageUrl: string | null = 'https://img/x.jpg'): VolumeCandidateDto {
  return { edition, volumeNumber, imageUrl, title: `Tome ${volumeNumber}`, alreadyOwned: false }
}

/** The provider, simulated: one answer per call, in order. */
function fournisseur(...reponses: { volumes: VolumeCandidateDto[]; quotaExceeded: boolean }[]) {
  const chercher = vi.fn()
  for (const reponse of reponses) chercher.mockResolvedValueOnce(reponse)
  return chercher
}

describe('variantsMissingCover', () => {
  it('only keeps the numbered volumes without a cover', () => {
    const serie = oeuvre({
      titre: 'Berserk',
      tomes: [
        tome(1),
        tome(2, { jaquette: 'https://img/2.jpg' }),
        tome(null, { libelle: 'Coffret' }),
      ],
    })

    expect(variantsMissingCover(serie).map((v) => v.id)).toEqual(['tome-1'])
  })
})

describe('findBestCoverMatch', () => {
  const candidats = [candidat(3, 'KANA'), candidat(3, 'Glénat'), candidat(4, 'Glénat')]

  it('prefers the same edition, regardless of the case', () => {
    // The case is only lowered HERE: at an external provider, "Kana" and
    // "KANA" are the same edition.
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: 3, edition: 'kana' } })?.edition).toBe('KANA')
  })

  it('without a given edition, takes the first match of the right volume', () => {
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: 3 } })?.edition).toBe('KANA')
  })

  it('builds nothing for a volume that is absent from the result', () => {
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: 9 } })).toBeUndefined()
  })

  it('ignores a match without an image: it would bring nothing', () => {
    expect(findBestCoverMatch([candidat(3, 'Glénat', null)], { attributes: { volumeNumber: 3 } })).toBeUndefined()
  })

  it('searches nothing for a volume without a usable number', () => {
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: '3' } })).toBeUndefined()
  })
})

describe('rattraperJaquettes', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1, { edition: 'Glénat' }), tome(2, { edition: 'Glénat' })] })

  it('does not call the provider when nothing is missing', async () => {
    const complete = oeuvre({ titre: 'Pluto', tomes: [tome(1, { jaquette: 'https://img/1.jpg' })] })
    const chercher = fournisseur()
    const enregistrer = vi.fn()

    const resultat = await rattraperJaquettes(complete, 'type-manga', chercher, enregistrer)

    expect(chercher).not.toHaveBeenCalled()
    expect(resultat).toEqual({ trouvees: 0, fournisseurMuet: false })
  })

  it('stops at a single search when it is enough', async () => {
    const chercher = fournisseur({
      volumes: [candidat(1, 'Glénat'), candidat(2, 'Glénat')],
      quotaExceeded: false,
    })
    const enregistrer = vi.fn().mockResolvedValue(undefined)

    const resultat = await rattraperJaquettes(serie, 'type-manga', chercher, enregistrer)

    expect(chercher).toHaveBeenCalledTimes(1)
    expect(resultat.trouvees).toBe(2)
    expect(enregistrer).toHaveBeenCalledWith('berserk', 'tome-1', 'https://img/x.jpg')
  })

  it('forces the cache a second time only if a volume is still without a cover', async () => {
    const chercher = fournisseur(
      { volumes: [candidat(1, 'Glénat')], quotaExceeded: false },
      { volumes: [candidat(1, 'Glénat'), candidat(2, 'Glénat')], quotaExceeded: false },
    )
    const enregistrer = vi.fn().mockResolvedValue(undefined)

    const resultat = await rattraperJaquettes(serie, 'type-manga', chercher, enregistrer)

    expect(chercher).toHaveBeenCalledTimes(2)
    expect(chercher.mock.calls[0][2]).not.toMatchObject({ forceRefresh: true })
    expect(chercher.mock.calls[1][2]).toMatchObject({ forceRefresh: true })
    expect(resultat.trouvees).toBe(2)
  })

  it('reports a silent provider, and writes nothing', async () => {
    const chercher = fournisseur({ volumes: [], quotaExceeded: true })
    const enregistrer = vi.fn()

    const resultat = await rattraperJaquettes(serie, 'type-manga', chercher, enregistrer)

    expect(resultat).toEqual({ trouvees: 0, fournisseurMuet: true })
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('tells "silent" apart from "it does not have this cover"', async () => {
    const chercher = fournisseur(
      { volumes: [], quotaExceeded: false },
      { volumes: [], quotaExceeded: false },
    )

    const resultat = await rattraperJaquettes(serie, 'type-manga', chercher, vi.fn())

    expect(resultat).toEqual({ trouvees: 0, fournisseurMuet: false })
  })

  it('a failing series does not make the whole backfill fail', async () => {
    const chercher = vi.fn().mockRejectedValue(new Error('503'))

    await expect(rattraperJaquettes(serie, 'type-manga', chercher, vi.fn())).resolves.toEqual({
      trouvees: 0,
      fournisseurMuet: false,
    })
  })
})
