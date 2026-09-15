import { MAX_OCTETS_PAR_PHOTO, MAX_PHOTOS_ENVOYEES } from '@/common/api/listingRecognition'

/**
 * Les photos qu'on envoie à la lecture (annonce ou étagère) : ce qui part, et
 * ce qu'on dit de ce qui ne part pas.
 *
 * Filtré ICI plutôt que de laisser le serveur refuser : dire « cette photo
 * fait 8 Mo » au moment du choix évite un aller-retour et une erreur qui ne
 * nommerait pas le fichier fautif. Partagé entre l'analyse d'annonce et
 * l'import d'étagère pour que les deux écrans tiennent la même règle.
 */
export interface SelectionDePhotos {
  retenues: File[]
  /** Ce qui a été écarté ou tronqué, en une phrase - `null` quand tout part. */
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

/** Les paliers essayés pour faire passer une photo sous la limite : côté max, qualité JPEG. */
const PALIERS: ReadonlyArray<readonly [number, number]> = [
  [2400, 0.85],
  [1800, 0.8],
  [1400, 0.75],
]

/**
 * Réduit une photo trop lourde pour passer sous la limite du serveur.
 *
 * Les téléphones produisent 4 à 8 Mo par cliché, et une rangée de tranches
 * reste lisible à 2400 px de large : refuser ces photos aurait fermé l'import
 * à l'usage le plus courant, l'étagère prise au téléphone. Rend le fichier
 * d'origine si le navigateur ne sait pas dessiner (jsdom, très vieux
 * navigateurs) ou si aucune réduction ne suffit - le serveur dira alors
 * « trop lourde » lui-même.
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

/** Réduit ce qui est trop lourd, puis retient : ce que les écrans appellent. */
export async function preparerLesPhotos(liste: FileList | File[] | null): Promise<SelectionDePhotos> {
  if (!liste || liste.length === 0) return { retenues: [], message: null }
  const reduites = await Promise.all(Array.from(liste).map(reduireSiTropLourde))
  return retenirLesPhotos(reduites)
}
