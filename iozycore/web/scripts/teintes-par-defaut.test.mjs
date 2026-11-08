/**
 * The default cover tones written in src/index.css.
 *
 * The page outside the shell (sign-in) reads them before any script, and the
 * contrast script checks them: they must be exactly the terracotta tones the
 * shell would set (lib/teinte/derivation.ts). A charter change that moves the
 * derivation without moving these values fails here.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deriverTeintes, enRgb, TERRACOTTA } from '../src/common/lib/teinte/derivation.ts'

// Vitest runs from iozycore/web/ (jsdom gives import.meta.url an http scheme).
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\r\n/g, '\n')

function bloc(theme) {
  return css.match(new RegExp(`\\{\\s*/\\* teinte - ${theme} theme \\*/([^}]*)\\}`))?.[1] ?? ''
}

const valeur = (texte, nom) => texte.match(new RegExp(`--teinte-${nom}:\\s*([^;]+);`))?.[1]

describe('the default tones of index.css', () => {
  it.each(['dark', 'light'])('match the terracotta derivation in the %s theme', (theme) => {
    const attendu = deriverTeintes(TERRACOTTA, theme)
    expect(valeur(bloc(theme), 'sombre')).toBe(enRgb(attendu.sombre))
    expect(valeur(bloc(theme), 'vive')).toBe(enRgb(attendu.vive))
    expect(valeur(bloc(theme), 'encre')).toBe(enRgb(attendu.encre))
  })

  it('registers the dark values as the initial values of the properties', () => {
    // A browser that reads @property before the theme rule paints these.
    const sombre = deriverTeintes(TERRACOTTA, 'dark')
    for (const [nom, couleur] of [['sombre', sombre.sombre], ['vive', sombre.vive], ['encre', sombre.encre]]) {
      expect(css).toMatch(new RegExp(`@property --teinte-${nom} \\{[^}]*initial-value: ${enRgb(couleur).replace(/[()]/g, '\\$&')};`))
    }
  })
})
