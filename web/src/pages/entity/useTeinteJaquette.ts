import { useEffect, useState } from 'react'

/** Brand terracotta: the fallback tint when the cover is missing, does not
 *  load, or refuses to be read (see below). */
const REPLI: [number, number, number] = [188, 88, 59]

/**
 * The average color of a cover, to tint the top of its detail page.
 *
 * <h2>Why sampling and not a stored color</h2>
 * The mockup "Fiche série - multi-éditions" derives the whole top band
 * from the cover: each series has its own mood without anyone having to enter
 * anything. Storing a color in the database would be one more piece of data to
 * keep up to date at each cover change, for information that is
 * recomputed in three milliseconds.
 *
 * <h2>What fails, and why it does not matter</h2>
 * Covers come from external hosts (MyAnimeList, Google Books, BGG).
 * Reading the pixels of an image from another domain "taints" the canvas and makes
 * `getImageData` throw - unless the host returns the CORS headers, which
 * many do not. So we load a SEPARATE image with
 * `crossOrigin = 'anonymous'`: if the host cooperates, we get the tint; if it
 * refuses, that image fails silently and we keep the brand terracotta.
 * In both cases the cover displayed on screen is
 * never touched - this is the whole point of not reusing the same tag.
 */
export function useTeinteJaquette(url: string | null | undefined): [number, number, number] {
  const [teinte, setTeinte] = useState<[number, number, number]>(REPLI)

  useEffect(() => {
    if (!url) {
      setTeinte(REPLI)
      return
    }
    // `annule` rather than an AbortController: an Image cannot be cancelled, we
    // just ignore its answer if the detail page changed in the meantime - otherwise
    // the tint of a previous series would overwrite that of the new one.
    let annule = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (annule) return
      try {
        // 24x24 is more than enough for an average, and avoids decoding
        // a full-resolution cover just to get three numbers out of it.
        const canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        const contexte = canvas.getContext('2d')
        if (!contexte) return
        contexte.drawImage(image, 0, 0, 24, 24)
        const pixels = contexte.getImageData(0, 0, 24, 24).data
        let r = 0
        let v = 0
        let b = 0
        let n = 0
        for (let i = 0; i < pixels.length; i += 4) {
          // Nearly transparent pixels say nothing about the color of the
          // cover and would pull the average toward black.
          if (pixels[i + 3] < 32) continue
          r += pixels[i]
          v += pixels[i + 1]
          b += pixels[i + 2]
          n += 1
        }
        if (n === 0) return
        setTeinte([Math.round(r / n), Math.round(v / n), Math.round(b / n)])
      } catch {
        // Canvas tainted by an image without CORS: we keep the fallback.
      }
    }
    image.src = url
    return () => {
      annule = true
    }
  }, [url])

  return teinte
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
