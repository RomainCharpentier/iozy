import { useEffect, useState } from 'react'

/** Terracotta de la marque : la teinte de repli quand la jaquette manque, ne
 *  charge pas, ou refuse d'être lue (voir plus bas). */
const REPLI: [number, number, number] = [188, 88, 59]

/**
 * La couleur moyenne d'une jaquette, pour teinter le haut de sa fiche.
 *
 * <h2>Pourquoi un échantillonnage et pas une couleur stockée</h2>
 * La maquette « Fiche série - multi-éditions » fait dériver toute la bande
 * haute de la jaquette : chaque série a son ambiance sans qu'on ait à saisir
 * quoi que ce soit. Stocker une couleur en base serait une donnée de plus à
 * tenir à jour à chaque changement de jaquette, pour une information qui se
 * recalcule en trois millisecondes.
 *
 * <h2>Ce qui échoue, et pourquoi ce n'est pas grave</h2>
 * Les jaquettes viennent d'hôtes externes (MyAnimeList, Google Books, BGG).
 * Lire les pixels d'une image d'un autre domaine « salit » le canvas et fait
 * lever `getImageData` — sauf si l'hôte renvoie les en-têtes CORS, ce que
 * beaucoup ne font pas. On charge donc une image SÉPARÉE en
 * `crossOrigin = 'anonymous'` : si l'hôte coopère, on obtient la teinte ; s'il
 * refuse, cette image-là échoue silencieusement et on garde le terracotta de
 * la marque. Dans les deux cas la jaquette affichée à l'écran, elle, n'est
 * jamais touchée — c'est tout l'intérêt de ne pas réutiliser la même balise.
 */
export function useTeinteJaquette(url: string | null | undefined): [number, number, number] {
  const [teinte, setTeinte] = useState<[number, number, number]>(REPLI)

  useEffect(() => {
    if (!url) {
      setTeinte(REPLI)
      return
    }
    // `annule` plutôt qu'un AbortController : une Image ne s'annule pas, on se
    // contente d'ignorer sa réponse si la fiche a changé entre-temps - sinon
    // la teinte d'une série précédente écraserait celle de la nouvelle.
    let annule = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (annule) return
      try {
        // 24x24 suffit très largement pour une moyenne, et évite de décoder
        // une jaquette pleine résolution juste pour en tirer trois nombres.
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
          // Les pixels quasi transparents ne disent rien de la couleur de la
          // jaquette et tireraient la moyenne vers le noir.
          if (pixels[i + 3] < 32) continue
          r += pixels[i]
          v += pixels[i + 1]
          b += pixels[i + 2]
          n += 1
        }
        if (n === 0) return
        setTeinte([Math.round(r / n), Math.round(v / n), Math.round(b / n)])
      } catch {
        // Canvas sali par une image sans CORS : on garde le repli.
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
 * Une couleur CSS tirée de la teinte, ramenée vers son propre gris.
 *
 * `melange` = 0 garde la couleur de la jaquette telle quelle, 1 la ramène
 * entièrement au neutre. Le défaut (0.55) est celui de la maquette : assez de
 * couleur pour reconnaître la série, assez de gris pour que la bande reste un
 * fond et ne devienne pas un aplat coloré derrière du texte.
 */
export function tonDe(teinte: [number, number, number], alphaPourcent: number, melange = 0.55): string {
  const moyenne = (teinte[0] + teinte[1] + teinte[2]) / 3
  const vers = (composante: number) => Math.round(composante * (1 - melange) + moyenne * melange)
  return `rgb(${vers(teinte[0])} ${vers(teinte[1])} ${vers(teinte[2])} / ${alphaPourcent}%)`
}
