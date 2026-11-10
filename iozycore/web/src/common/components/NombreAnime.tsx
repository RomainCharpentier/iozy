import { useEffect, useRef, useState } from 'react'

/** True when the person accepts motion. No `matchMedia` (tests, old browsers) counts as no. */
function mouvementAutorise(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
}

/**
 * A big number that counts up to its value, then follows it when it changes.
 * It ends on the exact value, and shows it at once when motion is reduced or
 * when the value is not a finite number. The shown text is a decoration of
 * the real value: callers that need a name for assistive tools give it apart.
 */
export function NombreAnime({
  valeur,
  format = (n: number) => String(Math.round(n)),
  dureeMs = 900,
}: {
  valeur: number
  format?: (n: number) => string
  dureeMs?: number
}) {
  const [affiche, setAffiche] = useState(valeur)
  const depart = useRef(valeur)

  useEffect(() => {
    if (!Number.isFinite(valeur) || !mouvementAutorise() || depart.current === valeur) {
      depart.current = valeur
      setAffiche(valeur)
      return
    }
    const de = depart.current
    const debut = performance.now()
    let image = 0
    const pas = (maintenant: number) => {
      const t = Math.min(1, (maintenant - debut) / dureeMs)
      const douce = 1 - Math.pow(1 - t, 3)
      setAffiche(de + (valeur - de) * douce)
      if (t < 1) image = requestAnimationFrame(pas)
      else depart.current = valeur
    }
    setAffiche(de)
    image = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(image)
  }, [valeur, dureeMs])

  return <>{format(affiche)}</>
}
