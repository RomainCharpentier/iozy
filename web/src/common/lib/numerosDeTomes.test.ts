import { describe, expect, it } from 'vitest'
import { resumerNumeros } from './numerosDeTomes'

describe('les numéros de tomes, lisibles d’un coup d’œil', () => {
  it('replie une suite de trois numéros ou plus, garde le reste tel quel', () => {
    expect(resumerNumeros([74, 11, 51, 52, 53, 48, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73])).toBe(
      '11, 48, 51 à 74',
    )
    expect(resumerNumeros([1, 2, 3, 4, 7])).toBe('1 à 4, 7')
  })

  it('ne replie pas deux numéros qui se suivent', () => {
    expect(resumerNumeros([1, 2])).toBe('1, 2')
    expect(resumerNumeros([5])).toBe('5')
  })

  it('ignore les doublons et rend vide sans numéro', () => {
    expect(resumerNumeros([3, 3, 4, 5, 5])).toBe('3 à 5')
    expect(resumerNumeros([])).toBe('')
  })
})
