import { useEffect, useState } from 'react'
import { couleursDominantes, type CouleursJaquette } from './couleursJaquette'
import { TERRACOTTA } from './derivation'

/** Brand terracotta: only for a work without a cover, or one that cannot be read at all. */
const REPLI: CouleursJaquette = { principale: TERRACOTTA, seconde: TERRACOTTA }

/**
 * Why the brand color stands in for the cover:
 * - `sans-jaquette`: there is no cover;
 * - `cors`: the image loads, but its host forbids reading its pixels (the app
 *   says so, discreetly - see PleinCadre);
 * - `illisible`: the image does not load at all.
 */
export type RaisonRepli = 'sans-jaquette' | 'cors' | 'illisible'

interface Lecture {
  couleurs: CouleursJaquette | null
  raison: RaisonRepli | null
}

/** What was already read in this visit: going back to a work shows its colors at once. */
const lues = new Map<string, Lecture>()

function lire(source: string): Promise<CouleursJaquette | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onerror = () => resolve(null)
    image.onload = () => {
      try {
        // 32x32 is enough to tell the colors apart, and avoids decoding a
        // full-resolution cover just to get a few numbers out of it.
        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 32
        const contexte = canvas.getContext('2d')
        if (!contexte) return resolve(null)
        contexte.drawImage(image, 0, 0, 32, 32)
        resolve(couleursDominantes(contexte.getImageData(0, 0, 32, 32).data))
      } catch {
        resolve(null)
      }
    }
    image.src = source
  })
}

/**
 * Does the image load at all, when its pixels are not asked for? An image that
 * loads this way but failed with `crossOrigin` is one whose host refused CORS.
 */
function seCharge(source: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = source
  })
}

async function lireJaquette(url: string): Promise<Lecture> {
  const couleurs = (await lire(`/api/covers/image?url=${encodeURIComponent(url)}`)) ?? (await lire(url))
  if (couleurs) return { couleurs, raison: null }
  return { couleurs: null, raison: (await seCharge(url)) ? 'cors' : 'illisible' }
}

export interface TeinteJaquette extends CouleursJaquette {
  connue: boolean
  /** Null when the colors are the cover's own; otherwise why the terracotta stands in. */
  repli: RaisonRepli | null
}

/**
 * The colors of a cover (see couleursDominantes): the background of the page.
 *
 * <h2>Why through the server</h2>
 * A browser only reads the pixels of an image whose host allows it. BoardGameGeek
 * does not, and AniList only answers when its image is not already in the cache:
 * 15 covers out of 35 fell back on the brand color. So the known cover hosts are read
 * through the API, from this origin (see CoverImageController). A cover typed by
 * hand on another host is still tried directly: it may allow it. The image shown on
 * screen is never touched.
 *
 * <p>`connue`: the colors have an answer. Until then the page shows no color rather
 * than the terracotta, which would flash on every series that is not red.
 */
export function useTeinteJaquette(url: string | null | undefined): TeinteJaquette {
  const [, setLues] = useState(0)

  useEffect(() => {
    if (!url || lues.has(url)) return
    let annule = false
    void (async () => {
      lues.set(url, await lireJaquette(url))
      if (!annule) setLues((n) => n + 1)
    })()
    return () => {
      annule = true
    }
  }, [url])

  if (!url) return { ...REPLI, connue: true, repli: 'sans-jaquette' }
  const lecture = lues.get(url)
  if (!lecture) return { ...REPLI, connue: false, repli: null }
  return { ...(lecture.couleurs ?? REPLI), connue: true, repli: lecture.raison }
}

/**
 * A CSS color taken from the tint, brought toward its own gray.
 *
 * `melange` = 0 keeps the color of the cover as is, 1 brings it
 * entirely to neutral. The default (0.55) is the one of the mockup: enough
 * color to recognize the series, enough gray for the band to stay a
 * background and not become a colored flat area behind text.
 */
export function tonDe(teinte: [number, number, number], alphaPourcent: number, melange = 0.55): string {
  const moyenne = (teinte[0] + teinte[1] + teinte[2]) / 3
  const vers = (composante: number) => Math.round(composante * (1 - melange) + moyenne * melange)
  return `rgb(${vers(teinte[0])} ${vers(teinte[1])} ${vers(teinte[2])} / ${alphaPourcent}%)`
}
