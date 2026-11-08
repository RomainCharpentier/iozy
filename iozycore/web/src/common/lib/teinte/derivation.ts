import kit from 'iozykit/tokens.json'
import type { Couleur } from './couleursJaquette'

/**
 * The two tones of the "plein cadre" look, taken from the cover on screen:
 * `sombre` paints the background (the veil over the blurred cover), `vive`
 * paints the accent (buttons, progress bars, what is missing), and `encre` is
 * the text written ON a vivid fill.
 *
 * <h2>"sombre" is the background tone, in both themes</h2>
 * In the dark theme it is a deep tone; in the light theme it is a pale one.
 * The name follows the role (the background), not the lightness.
 *
 * <h2>The guarantee</h2>
 * The cover under the veil is unknown: a blurred white margin and a blurred
 * black panel are both possible. So the tones are checked against the two
 * worst covers, pure black and pure white, after the same layers the screen
 * draws: the backdrop filter (`backdrop-brightness`), the veil (the
 * `sombre` tone at the opacity of the kit `backdrop-veil`), then the light or
 * the strong glass. On each layer the text roles of the kit must reach AA
 * (4.5:1), and so must `vive`, which is also written as text (kickers,
 * links). The lightness is moved step by step until they do. The `encre` is
 * the kit ink of the accent, so a vivid fill reads like the terracotta one.
 *
 * All the numbers come from iozykit/tokens.json: the kit check
 * (`npm run check:contrast` there) proves the same layers with a neutral veil.
 */
export type ThemeTeinte = 'dark' | 'light'

export interface TeintesPleinCadre {
  sombre: Couleur
  vive: Couleur
  encre: Couleur
  /** The veil drawn over the blurred cover: `sombre` with the kit opacity. */
  voileAlpha: number
}

/** The brand terracotta: the fallback for no cover, or a cover that cannot be read. */
export const TERRACOTTA: Couleur = [188, 88, 59]

const SEUIL_AA = 4.5
/** The opacity of the accent tint (`--color-accentTint`, 16 % in index.css), rounded up. */
const TEINTE_ALPHA = 0.18

interface Rgba {
  couleur: Couleur
  alpha: number
}

function parse(valeur: string): Rgba {
  const hex = valeur.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { couleur: [n >> 16, (n >> 8) & 255, n & 255], alpha: 1 }
  }
  const rgba = valeur.match(/^rgba?\(([^)]+)\)$/)
  if (!rgba) throw new Error(`Unreadable kit color: ${valeur}`)
  const [r, g, b, a = 1] = rgba[1].split(',').map(Number)
  return { couleur: [r, g, b], alpha: a }
}

function poser(dessus: Rgba, dessous: Couleur): Couleur {
  return [0, 1, 2].map((i) => dessus.couleur[i] * dessus.alpha + dessous[i] * (1 - dessus.alpha)) as Couleur
}

function luminance([r, g, b]: Couleur): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contraste(a: Couleur, b: Couleur): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** What the kit says for one theme, read once. */
function lireTheme(theme: ThemeTeinte) {
  const t = kit.themes[theme] as Record<string, string>
  const couleur = (role: string) => parse(t[role]).couleur
  return {
    eclat: Number(t['backdrop-brightness']),
    voileAlpha: parse(t['backdrop-veil']).alpha,
    verre: parse(t['glass-surface']),
    verreFort: parse(t['glass-surface-strong']),
    textes: ['text', 'text-dim', 'text-muted', 'text-faint'].map(couleur),
    textesSurVerre: ['text', 'text-dim'].map(couleur),
    surfaces: ['bg', 'surface', 'surface2'].map(couleur),
    encre: couleur('accent-ink'),
  }
}

const THEMES = { dark: lireTheme('dark'), light: lireTheme('light') }

/** The layers a text can land on, for the two worst covers. */
export function fondsComposes(sombre: Couleur, theme: ThemeTeinte): { fond: Couleur; verre: 'aucun' | 'leger' | 'fort' }[] {
  const t = THEMES[theme]
  const voile: Rgba = { couleur: sombre, alpha: t.voileAlpha }
  return [0, 255].flatMap((pixel) => {
    const filtre = Math.min(255, pixel * t.eclat)
    const voilee = poser(voile, [filtre, filtre, filtre])
    return [
      { fond: voilee, verre: 'aucun' as const },
      { fond: poser(t.verre, voilee), verre: 'leger' as const },
      { fond: poser(t.verreFort, voilee), verre: 'fort' as const },
    ]
  })
}

function textesTiennent(sombre: Couleur, theme: ThemeTeinte): boolean {
  const t = THEMES[theme]
  return fondsComposes(sombre, theme).every(({ fond, verre }) =>
    (verre === 'leger' ? t.textesSurVerre : t.textes).every((texte) => contraste(texte, fond) >= SEUIL_AA),
  )
}

function viveTient(vive: Couleur, sombre: Couleur, theme: ThemeTeinte): boolean {
  const t = THEMES[theme]
  const composes = fondsComposes(sombre, theme).map(({ fond }) => fond)
  // The accent is also written on its own tint (a selected chip, a hovered
  // row): the tint laid over each opaque surface of the theme.
  const teinte: Rgba = { couleur: vive, alpha: TEINTE_ALPHA }
  const fonds = [...composes, ...t.surfaces, ...t.surfaces.map((fond) => poser(teinte, fond))]
  return fonds.every((fond) => contraste(vive, fond) >= SEUIL_AA) && contraste(t.encre, vive) >= SEUIL_AA
}

function versHsl([r, g, b]: Couleur): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60
  else if (max === gg) h = ((bb - rr) / d + 2) * 60
  else h = ((rr - gg) / d + 4) * 60
  return [h, s, l]
}

function depuisHsl(h: number, s: number, l: number): Couleur {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** Below this saturation a cover has no hue to speak of: the brand hue stands in. */
const SATURATION_GRISE = 0.12

/**
 * The tones of one cover color for one theme.
 *
 * The hue of the cover is kept; its saturation is raised for `vive` (a
 * dull accent reads as disabled) and lowered for `sombre` (a background must
 * stay a background). A gray cover borrows the terracotta hue: an accent
 * with no hue is a gray button.
 */
export function deriverTeintes(source: Couleur, theme: ThemeTeinte): TeintesPleinCadre {
  let [h, s] = versHsl(source)
  if (s < SATURATION_GRISE) [h, s] = versHsl(TERRACOTTA)
  const sombre = theme === 'dark'
  const pas = 0.01

  const sSombre = Math.min(s, 0.5) * 0.6
  let lSombre = sombre ? 0.14 : 0.93
  let fond = depuisHsl(h, sSombre, lSombre)
  while (!textesTiennent(fond, theme) && lSombre > 0 && lSombre < 1) {
    lSombre = sombre ? lSombre - pas : lSombre + pas
    fond = depuisHsl(h, sSombre, Math.min(1, Math.max(0, lSombre)))
  }

  const sVive = Math.min(0.85, Math.max(s, 0.5))
  let lVive = sombre ? 0.62 : 0.42
  let vive = depuisHsl(h, sVive, lVive)
  while (!viveTient(vive, fond, theme) && lVive > 0 && lVive < 1) {
    lVive = sombre ? lVive + pas : lVive - pas
    vive = depuisHsl(h, sVive, Math.min(1, Math.max(0, lVive)))
  }

  return { sombre: fond, vive, encre: THEMES[theme].encre, voileAlpha: THEMES[theme].voileAlpha }
}

/** True when the tones of a theme reach AA on every layer (used by the tests). */
export function teintesConformes(teintes: TeintesPleinCadre, theme: ThemeTeinte): boolean {
  return textesTiennent(teintes.sombre, theme) && viveTient(teintes.vive, teintes.sombre, theme)
}

export const enRgb = ([r, g, b]: Couleur): string => `rgb(${r} ${g} ${b})`
