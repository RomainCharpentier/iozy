import { MAX_OCTETS_PAR_PHOTO, MAX_PHOTOS_ENVOYEES } from '@/common/api/listingRecognition'

/**
 * The photos we send to the reading (listing or shelf): what goes out, and
 * what we say about what does not go out.
 *
 * Filtered HERE rather than letting the server refuse: saying "this photo is
 * 8 MB" at the moment of the choice avoids a round trip and an error that
 * would not name the faulty file. Shared between the listing analysis and
 * the shelf import so that both screens hold the same rule.
 */
export interface SelectionDePhotos {
  retenues: File[]
  /** What was discarded or cut, in one sentence - `null` when everything goes out. */
  message: string | null
}

export function retenirLesPhotos(fichiers: File[]): SelectionDePhotos {
  const tropLourdes = fichiers.filter((f) => f.size > MAX_OCTETS_PAR_PHOTO)
  const retenues = fichiers.filter((f) => f.size <= MAX_OCTETS_PAR_PHOTO).slice(0, MAX_PHOTOS_ENVOYEES)

  const raisons: string[] = []
  if (tropLourdes.length > 0) {
    const plusieurs = tropLourdes.length > 1
    raisons.push(
      `${tropLourdes.length} photo${plusieurs ? 's' : ''} de plus de 3 Mo ${plusieurs ? 'ont' : 'a'} été écartée${
        plusieurs ? 's' : ''
      }`,
    )
  }
  if (fichiers.length - tropLourdes.length > MAX_PHOTOS_ENVOYEES) {
    raisons.push(`seules les ${MAX_PHOTOS_ENVOYEES} premières sont analysées`)
  }
  return { retenues, message: raisons.length > 0 ? `${raisons.join(', ')}.` : null }
}

/** The steps tried to bring a photo under the limit: max side, JPEG quality. */
const PALIERS: ReadonlyArray<readonly [number, number]> = [
  [2400, 0.85],
  [1800, 0.8],
  [1400, 0.75],
]

/**
 * Shrinks a photo that is too heavy to go under the server limit.
 *
 * Phones produce 4 to 8 MB per shot, and a row of spines stays readable at
 * 2400 px wide: refusing these photos would have closed the import to the
 * most common use, the shelf taken with a phone. Returns the original file
 * if the browser cannot draw (jsdom, very old browsers) or if no reduction
 * is enough - the server will then say "too heavy" itself.
 */
export async function reduireSiTropLourde(fichier: File): Promise<File> {
  if (fichier.size <= MAX_OCTETS_PAR_PHOTO) return fichier
  for (const [coteMax, qualite] of PALIERS) {
    const reduite = await redessiner(fichier, coteMax, qualite)
    if (reduite && reduite.size <= MAX_OCTETS_PAR_PHOTO) return reduite
  }
  return fichier
}

async function redessiner(fichier: File, coteMax: number, qualite: number): Promise<File | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
    const bitmap = await createImageBitmap(fichier)
    const echelle = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * echelle))
    canvas.height = Math.max(1, Math.round(bitmap.height * echelle))
    const contexte = canvas.getContext('2d')
    if (!contexte) return null
    contexte.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualite))
    if (!blob) return null
    const nom = `${fichier.name.replace(/\.[a-z0-9]+$/i, '')}.jpg`
    return new File([blob], nom, { type: 'image/jpeg' })
  } catch {
    return null
  }
}

/** Shrinks what is too heavy, then keeps: what the screens call. */
export async function preparerLesPhotos(liste: FileList | File[] | null): Promise<SelectionDePhotos> {
  if (!liste || liste.length === 0) return { retenues: [], message: null }
  const reduites = await Promise.all(Array.from(liste).map(reduireSiTropLourde))
  return retenirLesPhotos(reduites)
}
