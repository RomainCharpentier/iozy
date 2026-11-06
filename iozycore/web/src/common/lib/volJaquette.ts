import { flushSync } from 'react-dom'

const NOM_DU_VOL = 'vol-jaquette'
/** The cover of a detail page: where a flight from a shelf lands. */
const CIBLE_FICHE = '[data-cible-vol]'

export function mouvementReduit(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function attendreLaCible(selecteur: string, delaiMax: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const depart = Date.now()
    const chercher = () => {
      const cible = document.querySelector<HTMLElement>(selecteur)
      if (cible || Date.now() - depart >= delaiMax) resolve(cible)
      else window.setTimeout(chercher, 16)
    }
    chercher()
  })
}

/**
 * Changes page while a cover flies to its new place: from the shelf to the
 * detail page, and back.
 *
 * Without the API, or with reduced motion, it is a plain navigation. When the
 * page takes too long to come, the screen only crossfades: a frozen screen is
 * worse than a missing flight, so the wait stays short.
 */
export function naviguerAvecVol(
  source: HTMLElement | null,
  naviguer: () => void,
  selecteurCible: string = CIBLE_FICHE,
): void {
  const documentVol = document as Document & {
    startViewTransition?: (mise: () => Promise<void>) => { finished: Promise<void> }
  }
  if (!source || typeof documentVol.startViewTransition !== 'function' || mouvementReduit()) {
    naviguer()
    return
  }
  source.style.setProperty('view-transition-name', NOM_DU_VOL)
  let cible: HTMLElement | null = null
  let etagere: HTMLElement | null = null
  const transition = documentVol.startViewTransition(async () => {
    source.style.removeProperty('view-transition-name')
    flushSync(naviguer)
    cible = await attendreLaCible(selecteurCible, 450)
    cible?.style.setProperty('view-transition-name', NOM_DU_VOL)
    // A shelf that was just off screen skips its rendering, and a skipped element cannot be a target.
    etagere = cible?.closest<HTMLElement>('[data-rangee]') ?? null
    etagere?.style.setProperty('content-visibility', 'visible')
  })
  const nettoyer = () => {
    cible?.style.removeProperty('view-transition-name')
    etagere?.style.removeProperty('content-visibility')
  }
  transition.finished.then(nettoyer, nettoyer)
}
