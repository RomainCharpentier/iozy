/**
 * <b>Ce qu'on lit sur un tome, et ce qu'on refuse d'y lire.</b>
 *
 * Les attributs d'un Variant sont un sac non typé : c'est donc le lecteur qui
 * décide de ce qu'il accepte, et c'est exactement là que deux écrans ont déjà
 * divergé - l'assistant acceptait un numéro écrit en TEXTE (`"12"`), la grille
 * non. Un tome ainsi saisi était compté d'un côté et invisible de l'autre.
 *
 * <p>La règle vaut donc autant par ce qu'elle rend que par ce qu'elle rejette,
 * et le rejet est la moitié qu'aucun type ne protège : `attributes` étant
 * `Record<string, unknown>`, TypeScript laisse passer n'importe quoi.
 */
import { describe, expect, it } from 'vitest'
import { editionDe, numeroDe, variantLabel } from './attributsTome'

describe('numeroDe', () => {
  it('accepte un vrai nombre', () => {
    expect(numeroDe({ attributes: { volumeNumber: 12 } })).toBe(12)
    expect(numeroDe({ attributes: { volumeNumber: 0 } })).toBe(0)
  })

  it('refuse un numéro écrit en texte, même parfaitement numérique', () => {
    // Tolérer "12" ici reviendrait à accepter une donnée que les écrans
    // d'écriture s'interdisent de produire.
    expect(numeroDe({ attributes: { volumeNumber: '12' } })).toBeNull()
  })

  it('rend null pour tout ce qui n’est pas un nombre', () => {
    expect(numeroDe({ attributes: {} })).toBeNull()
    expect(numeroDe({ attributes: { volumeNumber: null } })).toBeNull()
    expect(numeroDe({ attributes: { volumeNumber: true } })).toBeNull()
  })
})

describe('editionDe', () => {
  it('découpe aux extrémités - un espace de saisie ne fait pas une autre édition', () => {
    expect(editionDe({ attributes: { edition: '  Glénat ' } })).toBe('Glénat')
  })

  it('conserve la casse : c’est ce nom qui s’affiche et que le serveur renvoie', () => {
    expect(editionDe({ attributes: { edition: 'KANA' } })).toBe('KANA')
  })

  it('rend la chaîne vide quand aucune édition n’est précisée', () => {
    // '' est une VALEUR ici (le groupe des tomes sans édition), pas une absence.
    expect(editionDe({ attributes: {} })).toBe('')
    expect(editionDe({ attributes: { edition: 42 } })).toBe('')
  })
})

describe('variantLabel', () => {
  const tome = (attributes: Record<string, unknown>, label: string) => ({
    id: 'v1',
    label,
    attributes,
    mangaEditionId: null,
  })

  it('nomme le tome par son numéro quand il en a un', () => {
    expect(variantLabel(tome({ volumeNumber: 12 }, 'Berserk tome douze'))).toBe('Tome 12')
  })

  it('retombe sur le libellé brut sans numéro exploitable', () => {
    expect(variantLabel(tome({ volumeNumber: '12' }, 'Coffret collector'))).toBe('Coffret collector')
  })
})
