import { describe, expect, it } from 'vitest'
import { rapportDuBloc, recadrer } from './recadrage'

describe('montrer un cadre en gros plan', () => {
  it('agrandit la photo pour que le cadre remplisse le bloc, et la décale dessus', () => {
    // Sans marge pour lire les chiffres : un cadre de 10 % de large, 80 % de
    // haut, qui commence à 20 % du bord gauche et 10 % du haut.
    const recadrage = recadrer({ image: 0, left: 0.2, top: 0.1, right: 0.3, bottom: 0.9 }, 0)

    expect(recadrage.largeur).toBeCloseTo(0.1)
    expect(recadrage.hauteur).toBeCloseTo(0.8)
    expect(recadrage.backgroundSize).toBe('1000.00% 125.00%')
    // 0,2 / (1 - 0,1) = 22,22 % ; 0,1 / (1 - 0,8) = 50 %
    expect(recadrage.backgroundPosition).toBe('22.22% 50.00%')
  })

  it('ajoute une marge sans jamais sortir de la photo', () => {
    const recadrage = recadrer({ image: 0, left: 0.02, top: 0.9, right: 0.1, bottom: 0.98 }, 0.06)

    expect(recadrage.largeur).toBeCloseTo(0.16)
    expect(recadrage.hauteur).toBeCloseTo(0.16)
    expect(recadrage.backgroundPosition).toBe('0.00% 100.00%')
  })

  it('un cadre qui couvre toute la photo se montre tel quel', () => {
    const recadrage = recadrer({ image: 0, left: 0, top: 0, right: 1, bottom: 1 })

    expect(recadrage.backgroundSize).toBe('100.00% 100.00%')
    expect(recadrage.backgroundPosition).toBe('0.00% 0.00%')
  })

  it('donne au bloc le rapport du morceau de photo montré', () => {
    const recadrage = recadrer({ image: 0, left: 0.2, top: 0.1, right: 0.3, bottom: 0.9 }, 0)

    expect(rapportDuBloc(recadrage, { w: 2000, h: 1000 })).toBe('200.0 / 800.0')
    // Photo de taille inconnue : un 4/3 par défaut, plutôt que rien.
    expect(rapportDuBloc(recadrage, undefined)).toBe('0.4 / 2.4')
  })
})
