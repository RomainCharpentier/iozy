/**
 * <b>« Retrouver les jaquettes manquantes » : deux appels au plus, et aucune
 * correspondance inventée.</b>
 *
 * Ce rattrapage tape chez un fournisseur externe soumis à quota (Google
 * Books). Trois règles en découlent, et chacune se casse sans que rien ne le
 * dise - au pire, le quota du jour part en fumée :
 * <ul>
 *   <li>rien à chercher ⇒ <b>aucun appel</b> ;</li>
 *   <li>la seconde recherche, celle qui force le rafraîchissement du cache et
 *       coûte un vrai appel, n'a lieu que si la première <b>ne suffit pas</b> ;</li>
 *   <li>un fournisseur <b>muet</b> (quota dépassé) n'est pas un fournisseur qui
 *       répond « je n'ai pas cette jaquette » : seul le premier change ce que
 *       l'utilisateur doit faire - réessayer plus tard.</li>
 * </ul>
 *
 * <p>Et jamais de jaquette posée au hasard : un tome absent du résultat reste
 * sans jaquette, une jaquette fausse serait pire que pas de jaquette.
 */
import { describe, expect, it, vi } from 'vitest'
import { findBestCoverMatch, rattraperJaquettes, variantsMissingCover } from './backfillCovers'
import { oeuvre, tome } from '../../test/fixtures'
import type { VolumeCandidateDto } from '../../types/api'

function candidat(volumeNumber: number, edition: string, imageUrl: string | null = 'https://img/x.jpg'): VolumeCandidateDto {
  return { edition, volumeNumber, imageUrl, title: `Tome ${volumeNumber}`, alreadyOwned: false }
}

/** Le fournisseur, simulé : une réponse par appel, dans l'ordre. */
function fournisseur(...reponses: { volumes: VolumeCandidateDto[]; quotaExceeded: boolean }[]) {
  const chercher = vi.fn()
  for (const reponse of reponses) chercher.mockResolvedValueOnce(reponse)
  return chercher
}

describe('variantsMissingCover', () => {
  it('ne retient que les tomes numérotés et sans jaquette', () => {
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

  it('préfère la même édition, sans se soucier de la casse', () => {
    // La casse n'est abaissée qu'ICI : chez un fournisseur externe, « Kana » et
    // « KANA » sont la même édition.
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: 3, edition: 'kana' } })?.edition).toBe('KANA')
  })

  it('à défaut d’édition renseignée, prend la première correspondance du bon tome', () => {
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: 3 } })?.edition).toBe('KANA')
  })

  it('ne fabrique rien pour un tome absent du résultat', () => {
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: 9 } })).toBeUndefined()
  })

  it('ignore une correspondance sans image : elle n’apporterait rien', () => {
    expect(findBestCoverMatch([candidat(3, 'Glénat', null)], { attributes: { volumeNumber: 3 } })).toBeUndefined()
  })

  it('ne cherche rien pour un tome sans numéro exploitable', () => {
    expect(findBestCoverMatch(candidats, { attributes: { volumeNumber: '3' } })).toBeUndefined()
  })
})

describe('rattraperJaquettes', () => {
  const serie = oeuvre({ titre: 'Berserk', tomes: [tome(1, { edition: 'Glénat' }), tome(2, { edition: 'Glénat' })] })

  it('n’appelle pas le fournisseur quand rien ne manque', async () => {
    const complete = oeuvre({ titre: 'Pluto', tomes: [tome(1, { jaquette: 'https://img/1.jpg' })] })
    const chercher = fournisseur()
    const enregistrer = vi.fn()

    const resultat = await rattraperJaquettes(complete, 'type-manga', chercher, enregistrer)

    expect(chercher).not.toHaveBeenCalled()
    expect(resultat).toEqual({ trouvees: 0, fournisseurMuet: false })
  })

  it('s’arrête à une seule recherche quand elle suffit', async () => {
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

  it('force le cache une seconde fois seulement s’il reste un tome sans jaquette', async () => {
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

  it('remonte un fournisseur muet, et n’écrit rien', async () => {
    const chercher = fournisseur({ volumes: [], quotaExceeded: true })
    const enregistrer = vi.fn()

    const resultat = await rattraperJaquettes(serie, 'type-manga', chercher, enregistrer)

    expect(resultat).toEqual({ trouvees: 0, fournisseurMuet: true })
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('distingue « muet » de « il n’a pas cette jaquette »', async () => {
    const chercher = fournisseur(
      { volumes: [], quotaExceeded: false },
      { volumes: [], quotaExceeded: false },
    )

    const resultat = await rattraperJaquettes(serie, 'type-manga', chercher, vi.fn())

    expect(resultat).toEqual({ trouvees: 0, fournisseurMuet: false })
  })

  it('une série en échec ne fait pas échouer le rattrapage entier', async () => {
    const chercher = vi.fn().mockRejectedValue(new Error('503'))

    await expect(rattraperJaquettes(serie, 'type-manga', chercher, vi.fn())).resolves.toEqual({
      trouvees: 0,
      fournisseurMuet: false,
    })
  })
})
