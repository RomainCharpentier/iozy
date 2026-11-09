import type { CollectionSummaryDto, YearlyRecapDto } from '@/common/types/api'
import type { SharedValueDto } from '@/common/types/share'
import { formaterEuros } from '@/common/lib/formats'

export interface ChiffreDuBilan {
  valeur: string
  libelle: string
}

export interface ContenuBilan {
  titre: string
  chiffres: ChiffreDuBilan[]
}

const NOMBRE = new Intl.NumberFormat('fr-FR')

function nombre(n: number): string {
  return NOMBRE.format(n).replace(/ /g, ' ')
}

/**
 * What the image says: the year, then the big numbers. The value is there
 * only when the server gave it, which it does only above the threshold of
 * prices (5 priced objects, half of the collection): never a total resting on
 * two prices in an image that leaves the app.
 */
export function contenuBilan({
  annee,
  resume,
  recap,
  valeur,
}: {
  annee: number
  resume: CollectionSummaryDto | null
  recap: YearlyRecapDto | null
  valeur: SharedValueDto | null
}): ContenuBilan {
  const chiffres: ChiffreDuBilan[] = []
  if (resume) {
    chiffres.push({ valeur: nombre(resume.totalObjects), libelle: resume.totalObjects > 1 ? 'objets dans ma collection' : 'objet dans ma collection' })
  }
  if (recap) {
    chiffres.push({ valeur: nombre(recap.acquisitionsCount), libelle: `ajout${recap.acquisitionsCount > 1 ? 's' : ''} en ${annee}` })
    if (recap.seriesStartedCount > 0) {
      chiffres.push({
        valeur: nombre(recap.seriesStartedCount),
        libelle: `série${recap.seriesStartedCount > 1 ? 's' : ''} commencée${recap.seriesStartedCount > 1 ? 's' : ''}`,
      })
    }
  }
  if (valeur) {
    chiffres.push({ valeur: formaterEuros(valeur.totalKnownValue), libelle: 'de valeur estimée' })
  }
  return { titre: `Mon année ${annee}`, chiffres }
}

/** The file name of the download. */
export function nomDuFichier(annee: number): string {
  return `bilan-iozy-${annee}.png`
}

export const LARGEUR = 1080
export const HAUTEUR = 1350

/**
 * Loads a cover through the server (same origin, see CoverImageController),
 * so drawing it does not taint the canvas. Null when it cannot be read: the
 * image is then drawn without it, never with a hole.
 */
function chargerJaquette(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = `/api/covers/image?url=${encodeURIComponent(url)}`
  })
}

/** Draws an image as `object-fit: cover` in the given box. */
function dessinerCouvrant(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, l: number, h: number) {
  const echelle = Math.max(l / image.width, h / image.height)
  const sl = l / echelle
  const sh = h / echelle
  ctx.drawImage(image, (image.width - sl) / 2, (image.height - sh) / 2, sl, sh, x, y, l, h)
}

function rectangleArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + l, y, x + l, y + h, r)
  ctx.arcTo(x + l, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + l, y, r)
  ctx.closePath()
}

/**
 * Draws the image of the year, entirely in the browser: the first cover
 * blurred as the backdrop (plein cadre), the year, the big numbers, then up
 * to four covers. Returns a PNG, or null when the browser cannot draw.
 */
export async function dessinerBilan(contenu: ContenuBilan, jaquettes: string[], accent: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = LARGEUR
  canvas.height = HAUTEUR
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const images = (await Promise.all(jaquettes.slice(0, 4).map(chargerJaquette))).filter(
    (image): image is HTMLImageElement => image !== null,
  )
  await document.fonts?.ready

  ctx.fillStyle = '#0d0b0a'
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR)
  if (images[0]) {
    ctx.save()
    ctx.filter = 'blur(60px) saturate(1.4)'
    dessinerCouvrant(ctx, images[0], -120, -120, LARGEUR + 240, HAUTEUR + 240)
    ctx.restore()
  }
  const voile = ctx.createLinearGradient(0, 0, 0, HAUTEUR)
  voile.addColorStop(0, 'rgba(13,11,10,0.45)')
  voile.addColorStop(1, 'rgba(13,11,10,0.85)')
  ctx.fillStyle = voile
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR)

  const marge = 88
  ctx.fillStyle = accent
  ctx.font = '600 30px Inter, sans-serif'
  ctx.fillText('IOZY · MON BILAN', marge, 130)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 120px "Space Grotesk", sans-serif'
  ctx.fillText(contenu.titre, marge, 260, LARGEUR - 2 * marge)

  let y = 420
  for (const chiffre of contenu.chiffres) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 104px "Space Grotesk", sans-serif'
    ctx.fillText(chiffre.valeur, marge, y, LARGEUR - 2 * marge)
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.font = '500 34px Inter, sans-serif'
    ctx.fillText(chiffre.libelle, marge, y + 50, LARGEUR - 2 * marge)
    y += 170
  }

  if (images.length > 0) {
    const ecart = 24
    const largeur = (LARGEUR - 2 * marge - ecart * 3) / 4
    const hauteur = largeur * 1.5
    const haut = HAUTEUR - marge - hauteur
    images.forEach((image, i) => {
      const x = marge + i * (largeur + ecart)
      ctx.save()
      rectangleArrondi(ctx, x, haut, largeur, hauteur, 18)
      ctx.clip()
      dessinerCouvrant(ctx, image, x, haut, largeur, hauteur)
      ctx.restore()
    })
  }

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      // A tainted canvas refuses to export: say it failed rather than hand out nothing.
      resolve(null)
    }
  })
}
