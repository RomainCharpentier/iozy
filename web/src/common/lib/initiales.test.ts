import { describe, expect, it } from 'vitest'
import { initiales } from './initiales'

/**
 * <b>Deux lettres sur l'élément le plus visible de l'en-tête.</b>
 *
 * <p>L'avatar affichait « IO » en dur, quel que soit le compte connecté. Il
 * porte maintenant les initiales du pseudo — et chaque règle ci-dessous casse
 * en silence : l'avatar affiche simplement autre chose, sur toutes les pages, à
 * côté de rien qui puisse le contredire.
 */
describe('les initiales d’un pseudo', () => {
  it('prend les deux premières lettres d’un pseudo d’un seul tenant', () => {
    expect(initiales('kenshin')).toBe('KE')
  })

  it('prend une lettre par morceau quand le pseudo en a plusieurs', () => {
    // « JE » ferait de jean-dupont et jean-durand le même avatar.
    expect(initiales('jean-dupont')).toBe('JD')
    expect(initiales('marie_c')).toBe('MC')
    expect(initiales('r.charpentier')).toBe('RC')
    expect(initiales('Jean Dupont')).toBe('JD')
  })

  it('s’arrête à deux morceaux, même quand le pseudo en a trois', () => {
    expect(initiales('jean-paul-sartre')).toBe('JP')
  })

  it('garde les accents et les met en capitales', () => {
    expect(initiales('Émile')).toBe('ÉM')
    expect(initiales('émile-zola')).toBe('ÉZ')
  })

  it('ne coupe pas une lettre en deux', () => {
    // Un caractère hors du plan de base s'écrit sur deux unités de code :
    // `pseudo[0]` en rendrait la moitié, soit un losange noir dans l'en-tête.
    expect(initiales('𝒜lice')).toBe('𝒜L')
  })

  it('rend du vide plutôt que d’inventer, quand il n’y a rien à lire', () => {
    expect(initiales('')).toBe('')
    expect(initiales('   ')).toBe('')
    expect(initiales('---')).toBe('')
  })
})
