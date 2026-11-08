export type Couleur = [number, number, number]

export interface CouleursJaquette {
  /** The color that covers the most of the cover. */
  principale: Couleur
  /** A clearly different color of the same cover; the main one when it has none. */
  seconde: Couleur
}

/** Under this saturation or brightness, a pixel says nothing about a hue. */
const SATURATION_MIN = 0.3
const LUMINOSITE_MIN = 50
/** The share of the cover a hue must cover to count as one of its colors. */
const PART_PRINCIPALE = 0.03
const PART_SECONDE = 0.015
const LARGEUR_TEINTE = 30
const ECART_SECONDE = 60

function moyenneDe(somme: Couleur, nombre: number): Couleur {
  return [Math.round(somme[0] / nombre), Math.round(somme[1] / nombre), Math.round(somme[2] / nombre)]
}

function teinteDe(r: number, v: number, b: number, max: number, min: number): number {
  const etendue = max - min
  if (max === r) return (((v - b) / etendue + 6) % 6) * 60
  if (max === v) return ((b - r) / etendue + 2) * 60
  return ((r - v) / etendue + 4) * 60
}

function ecartDeTeinte(a: number, b: number): number {
  const ecart = Math.abs(a - b)
  return Math.min(ecart, 360 - ecart)
}

/**
 * The real colors of a cover, read from its RGBA pixels.
 *
 * <p>The average of a colorful cover is gray: Frieren, olive and sky blue, gave
 * `177, 182, 170`. So the pixels are grouped by hue and the largest groups win.
 * The average only remains for a cover that really has no color. Null when
 * every pixel is transparent.
 */
export function couleursDominantes(pixels: ArrayLike<number>): CouleursJaquette | null {
  const groupes = new Map<number, { nombre: number; somme: Couleur }>()
  const somme: Couleur = [0, 0, 0]
  let total = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    // Nearly transparent pixels say nothing about the color of the cover.
    if (pixels[i + 3] < 32) continue
    const r = pixels[i]
    const v = pixels[i + 1]
    const b = pixels[i + 2]
    somme[0] += r
    somme[1] += v
    somme[2] += b
    total += 1
    const max = Math.max(r, v, b)
    const min = Math.min(r, v, b)
    if (max < LUMINOSITE_MIN || (max - min) / max < SATURATION_MIN) continue
    const cle = Math.floor(teinteDe(r, v, b, max, min) / LARGEUR_TEINTE) * LARGEUR_TEINTE
    const groupe = groupes.get(cle) ?? { nombre: 0, somme: [0, 0, 0] as Couleur }
    groupe.nombre += 1
    groupe.somme[0] += r
    groupe.somme[1] += v
    groupe.somme[2] += b
    groupes.set(cle, groupe)
  }
  if (total === 0) return null

  const classes = [...groupes.entries()].sort((a, b) => b[1].nombre - a[1].nombre)
  const premiere = classes[0]
  if (!premiere || premiere[1].nombre / total < PART_PRINCIPALE) {
    const moyenne = moyenneDe(somme, total)
    return { principale: moyenne, seconde: moyenne }
  }
  const principale = moyenneDe(premiere[1].somme, premiere[1].nombre)
  const autre = classes.find(
    ([teinte, groupe]) => ecartDeTeinte(teinte, premiere[0]) >= ECART_SECONDE && groupe.nombre / total >= PART_SECONDE,
  )
  return { principale, seconde: autre ? moyenneDe(autre[1].somme, autre[1].nombre) : principale }
}
