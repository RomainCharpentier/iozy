import { flushSync } from 'react-dom'
import { mouvementReduit } from '@/common/lib/volJaquette'

/** The easing of the whole shelf, the one of the validated prototype. */
const COURBE = 'cubic-bezier(.2,.8,.2,1)'
const SELECTEUR_OBJET = '[data-oeuvre]'
const SELECTEUR_RANGEE = '[data-rangee]'
/** While objects travel, a shelf must not clip them nor skip its rendering. */
const CLASSE_EN_MOUVEMENT = 'salles-en-mouvement'

function animer(element: Element, images: Keyframe[], options: KeyframeAnimationOptions): void {
  if (typeof element.animate !== 'function') return
  element.animate(images, { easing: COURBE, fill: 'backwards', ...options })
}

/** The objects of the shelves on screen. The others are skipped: a shelf far away is not painted anyway. */
function objetsVisibles(zone: HTMLElement): Map<string, HTMLElement> {
  const visibles = new Map<string, HTMLElement>()
  for (const rangee of zone.querySelectorAll<HTMLElement>(SELECTEUR_RANGEE)) {
    const cadre = rangee.getBoundingClientRect()
    if (cadre.bottom < -80 || cadre.top > window.innerHeight + 80) continue
    for (const objet of rangee.querySelectorAll<HTMLElement>(SELECTEUR_OBJET)) {
      if (objet.dataset.oeuvre) visibles.set(objet.dataset.oeuvre, objet)
    }
  }
  return visibles
}

/** Whatever is taken away shrinks and fades where it stood, over the page. */
function fairePartir(objet: HTMLElement, cadre: DOMRect, variables: [string, string][]): void {
  const fantome = objet.cloneNode(true) as HTMLElement
  fantome.removeAttribute('data-oeuvre')
  for (const [nom, valeur] of variables) fantome.style.setProperty(nom, valeur)
  Object.assign(fantome.style, {
    position: 'fixed',
    left: `${cadre.left}px`,
    top: `${cadre.top}px`,
    width: `${cadre.width}px`,
    margin: '0',
    zIndex: '2',
    pointerEvents: 'none',
  })
  document.body.append(fantome)
  const fin = fantome.animate(
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(.94)' },
    ],
    { duration: 200, easing: 'ease-out' },
  )
  fin.onfinish = () => fantome.remove()
  fin.oncancel = () => fantome.remove()
}

/**
 * Applies a change of filter or of view, then moves every work from its old
 * place and size to the new one, instead of redrawing the page under the eyes.
 */
export function deplacer(zone: HTMLElement | null, action: () => void, apres?: (zone: HTMLElement) => void): void {
  if (!zone || mouvementReduit() || typeof Element.prototype.animate !== 'function') {
    action()
    return
  }
  zone.classList.add(CLASSE_EN_MOUVEMENT)
  const avant = new Map(
    [...objetsVisibles(zone)].map(([id, objet]) => {
      // Read now: its sizes and its color come from the shelf and the room it may leave.
      const styles = getComputedStyle(objet)
      const variables = ['--h', '--w', '--u'].map((nom): [string, string] => [nom, styles.getPropertyValue(nom)])
      return [id, { objet, cadre: objet.getBoundingClientRect(), variables }]
    }),
  )
  flushSync(action)
  const encorePresentes = new Set(
    [...zone.querySelectorAll<HTMLElement>(SELECTEUR_OBJET)].map((objet) => objet.dataset.oeuvre),
  )
  for (const [id, { objet, cadre, variables }] of avant) {
    if (!encorePresentes.has(id)) fairePartir(objet, cadre, variables)
  }
  let rang = 0
  for (const [id, objet] of objetsVisibles(zone)) {
    const ancien = avant.get(id)?.cadre
    const cadre = objet.getBoundingClientRect()
    if (ancien) {
      const dx = ancien.left - cadre.left
      const dy = ancien.top - cadre.top
      const echelle = cadre.height > 0 ? ancien.height / cadre.height : 1
      if (dx || dy || echelle !== 1) {
        animer(
          objet,
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${echelle})`, transformOrigin: 'left top' },
            { transform: 'none', transformOrigin: 'left top' },
          ],
          { duration: 480, delay: Math.min(rang * 10, 120) },
        )
      }
    } else {
      animer(
        objet,
        [
          { opacity: 0, transform: 'translateY(16px) scale(.97)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 380, delay: Math.min(rang * 14, 200) },
      )
    }
    rang++
  }
  apres?.(zone)
  window.setTimeout(() => zone.classList.remove(CLASSE_EN_MOUVEMENT), 700)
}

/** Going back to the shelves: the spines come out of their cover, the bars draw themselves. */
export function sortirLesDos(zone: HTMLElement): void {
  let rang = 0
  for (const objet of objetsVisibles(zone).values()) {
    objet.querySelectorAll('[data-dos]').forEach((dos, index) =>
      animer(
        dos,
        [
          { opacity: 0, transform: 'translateX(-18px) scaleX(.4)', transformOrigin: 'left' },
          { opacity: 1, transform: 'none', transformOrigin: 'left' },
        ],
        { duration: 460, delay: 120 + Math.min(rang * 10, 160) + Math.min(index * 14, 160) },
      ),
    )
    const piste = objet.querySelector('[data-piste]')
    if (piste) {
      animer(
        piste,
        [
          { transform: 'scaleX(0)', transformOrigin: 'left' },
          { transform: 'none', transformOrigin: 'left' },
        ],
        { duration: 520, delay: 200 },
      )
    }
    rang++
  }
}

/** The first arrival on the page: planks, then the objects, room by room. Readable at rest whatever happens. */
export function installerLesObjets(zone: HTMLElement | null): void {
  if (!zone || mouvementReduit() || typeof Element.prototype.animate !== 'function') return
  zone.classList.add(CLASSE_EN_MOUVEMENT)
  zone.querySelectorAll('[data-planche]').forEach((planche, index) => {
    const cadre = planche.getBoundingClientRect()
    if (cadre.top > window.innerHeight) return
    animer(
      planche,
      [
        { opacity: 0, transform: 'scaleX(.15)', transformOrigin: 'left' },
        { opacity: 1, transform: 'none', transformOrigin: 'left' },
      ],
      { duration: 620, delay: Math.min(index * 60, 360) },
    )
  })
  let rang = 0
  for (const objet of objetsVisibles(zone).values()) {
    const delai = Math.min(rang * 28, 560)
    const face = objet.querySelector<HTMLElement>('[data-face]')
    if (face) {
      // Starts from nothing and lets the stylesheet decide where it ends: a wish stays faded.
      animer(face, [{ opacity: 0, transform: 'translateY(24px) scale(.97)' }, { transform: 'none' }], {
        duration: 520,
        delay: delai,
      })
    }
    objet.querySelectorAll('[data-dos]').forEach((dos, index) =>
      animer(dos, [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], {
        duration: 420,
        delay: delai + 90 + Math.min(index * 14, 200),
      }),
    )
    rang++
  }
  window.setTimeout(() => zone.classList.remove(CLASSE_EN_MOUVEMENT), 1400)
}
