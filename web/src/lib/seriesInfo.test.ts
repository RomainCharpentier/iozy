/**
 * <b>Ce qu'on sait d'une série, et ce qu'on refuse d'affirmer.</b>
 *
 * Ces deux attributs viennent d'une source externe et n'existent pas toujours :
 * une série ajoutée à la main n'en a aucun, et le nombre total de tomes n'est
 * stocké que pour les séries dont le fournisseur a arrêté le décompte.
 *
 * <p>La règle est donc partout la même dans ce dépôt, et c'est elle qui se
 * casse en silence : <b>ne jamais affirmer un statut qu'on ne connaît pas</b>.
 * `null` n'est pas « en cours » par défaut - c'est ce qui empêche un « X/Y »
 * de s'afficher avec un dénominateur deviné.
 */
import { describe, expect, it } from 'vitest'
import { isSeriesOngoing, totalVolumesFrom } from './seriesInfo'

describe('totalVolumesFrom', () => {
  it('rend le total quand la source l’a arrêté', () => {
    expect(totalVolumesFrom({ totalVolumes: 72 })).toBe(72)
  })

  it('refuse 0, un négatif, un texte, ou l’absence', () => {
    expect(totalVolumesFrom({ totalVolumes: 0 })).toBeNull()
    expect(totalVolumesFrom({ totalVolumes: -3 })).toBeNull()
    expect(totalVolumesFrom({ totalVolumes: '72' })).toBeNull()
    expect(totalVolumesFrom({})).toBeNull()
    expect(totalVolumesFrom(undefined)).toBeNull()
  })
})

describe('isSeriesOngoing', () => {
  it('comprend les deux vocabulaires de sources, jamais unifiés côté serveur', () => {
    expect(isSeriesOngoing({ seriesStatus: 'Publishing' })).toBe(true)
    expect(isSeriesOngoing({ seriesStatus: 'currently_publishing' })).toBe(true)
    expect(isSeriesOngoing({ seriesStatus: 'Finished' })).toBe(false)
    expect(isSeriesOngoing({ seriesStatus: 'finished' })).toBe(false)
  })

  it('rend null - et pas false - sur un statut qu’il ne sait pas lire', () => {
    // « on_hiatus », « discontinued » : ni en cours, ni terminée. Trancher
    // reviendrait à inventer.
    expect(isSeriesOngoing({ seriesStatus: 'on_hiatus' })).toBeNull()
    expect(isSeriesOngoing({ seriesStatus: 'discontinued' })).toBeNull()
    expect(isSeriesOngoing({})).toBeNull()
    expect(isSeriesOngoing(undefined)).toBeNull()
  })
})
