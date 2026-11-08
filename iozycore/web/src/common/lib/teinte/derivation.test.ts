/**
 * <b>The cover color never costs a contrast.</b> Whatever cover is on screen,
 * the text and the vivid accent stay AA on the background it makes, in both
 * themes, and the ink stays readable on the vivid fill.
 */
import { describe, expect, it } from 'vitest'
import type { Couleur } from './couleursJaquette'
import { contraste, deriverTeintes, fondsComposes, teintesConformes, TERRACOTTA, type ThemeTeinte } from './derivation'

const COUVERTURES: [string, Couleur][] = [
  ['very dark', [6, 4, 10]],
  ['very light', [250, 250, 244]],
  ['gray', [128, 128, 128]],
  ['saturated yellow', [255, 230, 0]],
  ['saturated blue', [0, 40, 255]],
  ['saturated green', [0, 255, 60]],
  ['terracotta', TERRACOTTA],
]
const THEMES: ThemeTeinte[] = ['dark', 'light']

describe('the tones of a cover', () => {
  for (const theme of THEMES) {
    for (const [nom, couleur] of COUVERTURES) {
      it(`reach AA on every layer for a ${nom} cover in the ${theme} theme`, () => {
        const teintes = deriverTeintes(couleur, theme)
        expect(teintesConformes(teintes, theme)).toBe(true)
        for (const { fond } of fondsComposes(teintes.sombre, theme)) {
          expect(contraste(teintes.vive, fond)).toBeGreaterThanOrEqual(4.5)
        }
        expect(contraste(teintes.encre, teintes.vive)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('keeps the hue of a colorful cover', () => {
    const { vive } = deriverTeintes([20, 60, 220], 'dark')
    // Blue stays blue: the blue channel leads.
    expect(vive[2]).toBeGreaterThan(vive[0])
    expect(vive[2]).toBeGreaterThan(vive[1])
  })

  it('gives a gray cover the brand hue rather than a gray accent', () => {
    const gris = deriverTeintes([128, 128, 128], 'light').vive
    const marque = deriverTeintes(TERRACOTTA, 'light').vive
    expect(gris).toEqual(marque)
  })

  it('makes a deep background in the dark theme and a pale one in the light theme', () => {
    const lum = (c: Couleur) => c[0] + c[1] + c[2]
    expect(lum(deriverTeintes([200, 40, 40], 'dark').sombre)).toBeLessThan(150)
    expect(lum(deriverTeintes([200, 40, 40], 'light').sombre)).toBeGreaterThan(600)
  })
})
