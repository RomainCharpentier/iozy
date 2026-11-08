/**
 * <b>A colorful cover gives its colors, not their gray average.</b> The average
 * of Frieren was a gray, and the top of its page and its spines with it.
 */
import { describe, expect, it } from 'vitest'
import { couleursDominantes, type Couleur } from './couleursJaquette'

/** RGBA pixels: each color repeated as many times as asked. */
function pixels(...zones: [Couleur, number][]): number[] {
  return zones.flatMap(([[r, v, b], nombre]) => Array.from({ length: nombre }, () => [r, v, b, 255]).flat())
}

const OLIVE: Couleur = [139, 158, 85]
const CIEL: Couleur = [113, 178, 204]
const GRIS: Couleur = [180, 180, 180]

describe('the colors of a cover', () => {
  it('takes the largest hue as the main color, not the average', () => {
    const couleurs = couleursDominantes(pixels([GRIS, 80], [OLIVE, 12], [CIEL, 8]))

    expect(couleurs?.principale).toEqual(OLIVE)
    expect(couleurs?.seconde).toEqual(CIEL)
  })

  it('reuses the main color when the cover has only one hue', () => {
    const couleurs = couleursDominantes(pixels([GRIS, 50], [OLIVE, 50]))

    expect(couleurs?.seconde).toEqual(OLIVE)
  })

  it('keeps the average for a cover without color', () => {
    const couleurs = couleursDominantes(pixels([[100, 100, 100], 50], [[200, 200, 200], 50]))

    expect(couleurs).toEqual({ principale: [150, 150, 150], seconde: [150, 150, 150] })
  })

  it('reads nothing from a transparent cover', () => {
    expect(couleursDominantes([10, 200, 10, 0])).toBeNull()
  })
})
